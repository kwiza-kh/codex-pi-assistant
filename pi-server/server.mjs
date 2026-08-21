#!/usr/bin/env node
/**
 * Pi Agent Bridge Server
 *
 * 在 Codex Assistant 前端与 `pi --mode rpc` 子进程之间建立 WebSocket 桥接。
 * - 前端通过 WebSocket 发送 RPC 命令，本服务转发到 pi 子进程 stdin。
 * - pi 子进程 stdout 的所有 JSON 事件/响应转发给所有已连接前端。
 * - 额外提供 server 级命令：ping / list_sessions / restart / get_cwd。
 *
 * 环境变量:
 *   PORT             WebSocket 端口（默认 8787）
 *   PI_BIN           pi 可执行文件（默认从 PATH 解析）
 *   PI_CWD           pi 子进程工作目录（默认继承当前目录）
 *   PI_SESSION_DIR   会话存储目录（默认 ~/.pi/agent/sessions）
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, renameSync, mkdirSync, unlinkSync, rmdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { ModelRuntime, ProjectTrustStore } from "@earendil-works/pi-coding-agent";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const AGENT_DIR = process.env.PI_AGENT_DIR || join(homedir(), ".pi", "agent");
const SESSION_DIR = process.env.PI_SESSION_DIR || join(AGENT_DIR, "sessions");
const SETTINGS_FILE = process.env.PI_SETTINGS_FILE || join(AGENT_DIR, "settings.json");
const AUTH_FILE = process.env.PI_AUTH_FILE || join(AGENT_DIR, "auth.json");
const MODELS_FILE = process.env.PI_MODELS_FILE || join(AGENT_DIR, "models.json");
const MODELS_STORE_FILE = process.env.PI_MODELS_STORE_FILE || join(AGENT_DIR, "models-store.json");

// 项目信任存储（~/.pi/agent/trust.json）
const trustStore = new ProjectTrustStore(AGENT_DIR);

// ---------------------------------------------------------------------------
// 定位 pi CLI
// ---------------------------------------------------------------------------

function resolvePiBin() {
  if (process.env.PI_BIN) return process.env.PI_BIN;
  // 全局 npm 安装路径（Windows 优先探测）
  const candidates = [];
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    candidates.push(
      join(appData, "npm", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "cli.js")
    );
  }
  candidates.push(
    join(homedir(), ".local", "share", "npm", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "cli.js"),
    join("/usr/local/lib", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "cli.js")
  );
  for (const c of candidates) {
    if (existsSync(c)) return { kind: "node", script: c };
  }
  return { kind: "bin", bin: process.platform === "win32" ? "pi.cmd" : "pi" };
}

const piBin = resolvePiBin();

// ---------------------------------------------------------------------------
// pi 子进程管理
// ---------------------------------------------------------------------------

let child = null;
let childCwd = process.env.PI_CWD ? resolve(process.env.PI_CWD) : process.cwd();
let childExitInfo = null;

function log(...args) {
  console.log(`[pi-server]`, ...args);
}

function spawnPi() {
  const args = ["--mode", "rpc"];
  if (process.env.PI_ARGS) {
    args.push(...process.env.PI_ARGS.split(" ").filter(Boolean));
  }

  let cmd, spawnArgs, options;
  if (piBin.kind === "node") {
    cmd = process.execPath;
    spawnArgs = [piBin.script, ...args];
    options = { cwd: childCwd, stdio: ["pipe", "pipe", "pipe"] };
  } else {
    cmd = piBin.bin;
    spawnArgs = args;
    options = { cwd: childCwd, stdio: ["pipe", "pipe", "pipe"], shell: process.platform === "win32" };
  }

  log(`启动 pi: ${cmd} ${spawnArgs.join(" ")} (cwd=${childCwd})`);
  const proc = spawn(cmd, spawnArgs, options);
  child = proc;
  childExitInfo = null;
  // 新进程 = 新的 JSONL 流，清掉旧进程可能残留的半行缓冲
  stdoutBuf = "";

  proc.stdout.on("data", (buf) => {
    broadcastRaw(buf.toString("utf8"));
  });

  proc.stderr.on("data", (buf) => {
    broadcast({ type: "stderr", data: buf.toString("utf8") });
  });

  proc.on("error", (err) => {
    log("pi 进程错误:", err.message);
    broadcast({ type: "stderr", data: `pi spawn error: ${err.message}\n` });
  });

  proc.on("exit", (code, signal) => {
    log(`pi 进程退出: code=${code} signal=${signal}`);
    child = null;
    childExitInfo = { code, signal };
    broadcast({ type: "agent_exit", code, signal });
  });

  return proc;
}

function writeToPi(obj) {
  if (!child || child.stdin.destroyed) {
    return false;
  }
  child.stdin.write(JSON.stringify(obj) + "\n");
  return true;
}

function killPi() {
  if (!child) return;
  const proc = child;
  child = null;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(proc.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      proc.kill("SIGTERM");
    }
  } catch {
    proc.kill();
  }
}

function restartPi(newCwd) {
  if (newCwd) childCwd = resolve(newCwd);
  killPi();
  spawnPi();
  return { cwd: childCwd };
}

// ---------------------------------------------------------------------------
// 会话列表（扫描 ~/.pi/agent/sessions 下的 JSONL）
// ---------------------------------------------------------------------------

function parseSessionFile(filePath) {
  try {
    const fd = readFileSync(filePath, "utf8");
    const lines = fd.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return null;
    const header = JSON.parse(lines[0]);
    if (header.type !== "session") return null;

    let title = "";
    let messageCount = 0;
    for (let i = 1; i < Math.min(lines.length, 400); i++) {
      let entry;
      try {
        entry = JSON.parse(lines[i]);
      } catch {
        continue;
      }
      if (entry.type === "message") {
        messageCount++;
        if (!title && entry.message?.role === "user") {
          const c = entry.message.content;
          title = typeof c === "string" ? c : Array.isArray(c) ? c.map((b) => b.text || "").join(" ") : "";
        }
      }
    }

    return {
      id: header.id,
      path: filePath,
      cwd: header.cwd ?? "",
      timestamp: header.timestamp ?? "",
      title: title ? title.slice(0, 80) : filePath.split(/[\\/]/).pop(),
      messageCount,
    };
  } catch {
    return null;
  }
}

function listSessions() {
  const sessions = [];
  if (!existsSync(SESSION_DIR)) return sessions;
  try {
    for (const dir of readdirSync(SESSION_DIR)) {
      const full = join(SESSION_DIR, dir);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;
      for (const file of readdirSync(full)) {
        if (!file.endsWith(".jsonl")) continue;
        const info = parseSessionFile(join(full, file));
        if (info) sessions.push(info);
      }
    }
  } catch (err) {
    log("扫描会话失败:", err.message);
  }
  sessions.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  return sessions;
}

function deleteSession(sessionPath) {
  if (!sessionPath || typeof sessionPath !== "string") {
    throw new Error("缺少 sessionPath");
  }
  const target = resolve(sessionPath);
  const sessionDir = resolve(SESSION_DIR);
  // 仅允许删除会话目录内的 .jsonl 文件，避免越界删除
  if (!target.endsWith(".jsonl") || !target.startsWith(sessionDir + sep)) {
    throw new Error("非法会话路径");
  }
  if (!existsSync(target)) {
    throw new Error("会话文件不存在");
  }
  unlinkSync(target);
  // 若父目录已空，一并清理
  try {
    const parent = dirname(target);
    if (readdirSync(parent).length === 0) rmdirSync(parent);
  } catch {
    // 忽略目录清理失败
  }
  return { path: target };
}

// ---------------------------------------------------------------------------
// 项目上下文文件（AGENTS.md / CLAUDE.md）读写
// ---------------------------------------------------------------------------

const CONTEXT_FILE_CANDIDATES = ["AGENTS.override.md", "AGENTS.md", "CLAUDE.md"];

function findContextFile(cwd) {
  // 优先在工作目录查找；找不到则回退到全局 ~/.pi/agent/AGENTS.md
  const globalFile = join(AGENT_DIR, "AGENTS.md");
  const dir = resolve(cwd || process.cwd());
  for (const name of CONTEXT_FILE_CANDIDATES) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return globalFile;
}

function readContextFile(cwd) {
  const path = findContextFile(cwd);
  if (!existsSync(path)) return { path, content: "" };
  try {
    return { path, content: readFileSync(path, "utf8") };
  } catch (err) {
    return { path, content: "", error: err.message };
  }
}

function writeContextFile(cwd, content) {
  const path = findContextFile(cwd);
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, String(content ?? ""), "utf8");
  return { path };
}

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "target", ".next", ".turbo", "venv", "__pycache__", ".venv"]);
const MAX_WORKSPACE_FILES = 500;

function listWorkspaceFiles() {
  const root = childCwd;
  const files = [];
  function walk(dir, depth) {
    if (files.length >= MAX_WORKSPACE_FILES || depth > 6) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (files.length >= MAX_WORKSPACE_FILES) return;
      if (ent.name.startsWith(".")) continue;
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (IGNORED_DIRS.has(ent.name)) continue;
        walk(full, depth + 1);
      } else if (ent.isFile()) {
        files.push(full);
      }
    }
  }
  walk(root, 0);
  // 返回相对工作目录的路径
  return files.map((f) => {
    const rel = f.startsWith(root + sep) ? f.slice(root.length + 1) : f;
    return rel.split(sep).join("/");
  });
}

// ---------------------------------------------------------------------------
// 全局设置读写（~/.pi/agent/settings.json）
// ---------------------------------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base, patch) {
  if (!isPlainObject(base)) return isPlainObject(patch) ? deepMerge({}, patch) : patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function readSettings() {
  try {
    if (!existsSync(SETTINGS_FILE)) return {};
    return JSON.parse(readFileSync(SETTINGS_FILE, "utf8"));
  } catch (err) {
    return { __parseError: err.message };
  }
}

function writeSettings(settings) {
  const dir = dirname(SETTINGS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = SETTINGS_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(settings, null, 2) + "\n", "utf8");
  renameSync(tmp, SETTINGS_FILE);
}

// ---------------------------------------------------------------------------
// ModelRuntime（Provider / 模型目录 / API Key 配置）
// ---------------------------------------------------------------------------

let modelRuntimePromise = null;

async function getModelRuntime() {
  if (!modelRuntimePromise) {
    modelRuntimePromise = ModelRuntime.create({
      authPath: AUTH_FILE,
      modelsPath: MODELS_FILE,
      modelsStorePath: MODELS_STORE_FILE,
      allowModelNetwork: false,
    });
  }
  return modelRuntimePromise;
}

async function listProviders() {
  const rt = await getModelRuntime();
  return rt.getProviders().map((p) => {
    const apiKeyAuth = p.auth?.apiKey ? { name: p.auth.apiKey.name } : null;
    const oauthAuth = p.auth?.oauth
      ? { name: p.auth.oauth.name, isSubscription: Boolean(p.auth.oauth.isSubscription) }
      : null;
    return {
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl ?? null,
      apiKeyAuth,
      oauthAuth,
      modelCount: rt.getModels(p.id).length,
    };
  });
}

async function providerAuthStatus(providerId) {
  const rt = await getModelRuntime();
  const provider = rt.getProvider(providerId);
  if (!provider) return { configured: false, check: null, error: `未知 Provider: ${providerId}` };
  let check = null;
  try {
    check = await rt.checkAuth(providerId);
  } catch {
    // 忽略，按未配置处理
  }
  const configured = Boolean(check);
  return {
    configured,
    check: check ? { source: check.source ?? null, type: check.type } : null,
    usingOAuth: configured ? rt.isUsingOAuth(providerId) : false,
    usingSubscription: configured ? rt.isUsingSubscription(providerId) : false,
  };
}

async function setProviderApiKey(providerId, apiKey) {
  const rt = await getModelRuntime();
  const provider = rt.getProvider(providerId);
  if (!provider) throw new Error(`未知 Provider: ${providerId}`);
  if (!provider.auth?.apiKey) throw new Error(`${provider.name} 不支持 API Key 配置`);

  // 官方持久化路径：Provider 自带 login 时使用 login 写入 auth.json
  if (provider.auth.apiKey.login) {
    const credential = await rt.login(providerId, "api_key", {
      signal: AbortSignal.timeout(30_000),
      prompt: async (p) => {
        if (p.type === "select") return String(p.options[0]?.id ?? "");
        return apiKey;
      },
      notify: () => {},
    });
    if (!credential) throw new Error("保存 API Key 失败");
  } else {
    // 无 login 的 ambient-only provider：直接写入 auth.json
    const auth = readAuthFile();
    auth[providerId] = { type: "api_key", key: apiKey };
    writeAuthFile(auth);
    modelRuntimePromise = null;
  }

  return providerAuthStatus(providerId);
}

async function removeProviderApiKey(providerId) {
  const auth = readAuthFile();
  delete auth[providerId];
  writeAuthFile(auth);
  modelRuntimePromise = null;
  return providerAuthStatus(providerId);
}

function readAuthFile() {
  try {
    if (!existsSync(AUTH_FILE)) return {};
    const parsed = JSON.parse(readFileSync(AUTH_FILE, "utf8"));
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAuthFile(auth) {
  const dir = dirname(AUTH_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = AUTH_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(auth, null, 2) + "\n", "utf8");
  renameSync(tmp, AUTH_FILE);
}

async function listModels(providerId) {
  const rt = await getModelRuntime();
  const models = providerId ? rt.getModels(providerId) : rt.getModels();
  return models.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    api: m.api,
    baseUrl: m.baseUrl ?? null,
    reasoning: Boolean(m.reasoning),
    input: Array.isArray(m.input) ? m.input : [],
    contextWindow: m.contextWindow ?? null,
    maxTokens: m.maxTokens ?? null,
    cost: m.cost ?? null,
  }));
}

async function refreshModels() {
  const rt = await getModelRuntime();
  const result = await rt.refresh({ allowNetwork: true, force: true });
  const errors = {};
  if (result.errors) {
    for (const [providerId, err] of result.errors) {
      errors[providerId] = err?.message ?? String(err);
    }
  }
  return { aborted: Boolean(result.aborted), errors };
}

// ---------------------------------------------------------------------------
// WebSocket 服务
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ port: PORT, host: "127.0.0.1" });
const clients = new Set();

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(data);
      } catch {
        /* ignore */
      }
    }
  }
}

// stdout 可能一次带多行 JSON，也可能出现跨 chunk 的半行。
// buf 必须是模块级（跨调用保留），否则大响应被拆成多个 data chunk 时半行会丢失，
// 导致响应帧被截断/错位（如 get_messages 返回大量消息时超时、出现残缺的非 JSON 行）。
let stdoutBuf = "";

function broadcastRaw(text) {
  stdoutBuf += text;
  let idx;
  while ((idx = stdoutBuf.indexOf("\n")) >= 0) {
    const line = stdoutBuf.slice(0, idx).replace(/\r$/, "");
    stdoutBuf = stdoutBuf.slice(idx + 1);
    if (line.trim()) broadcastJsonLine(line);
  }
}

function broadcastJsonLine(line) {
  // 校验必须是合法 JSON，避免 pi 子进程输出的非 JSON 行污染前端消息流
  try {
    JSON.parse(line);
  } catch {
    return;
  }
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(line);
      } catch {
        /* ignore */
      }
    }
  }
}

function sendToAll(obj) {
  const data = JSON.stringify(obj);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(data);
      } catch {
        /* ignore */
      }
    }
  }
}

// 服务端命令
const SERVER_COMMANDS = new Set(["ping", "list_sessions", "delete_session", "restart", "get_cwd", "get_server_info", "get_settings", "set_settings", "list_providers", "get_provider_auth", "set_provider_api_key", "remove_provider_api_key", "get_models", "refresh_models", "get_context_file", "set_context_file", "list_workspace_files", "get_project_trust", "set_project_trust"]);

async function handleServerCommand(msg) {
  switch (msg.type) {
    case "ping":
      return { type: "response", id: msg.id, command: "ping", success: true, data: { pong: true, pid: child?.pid ?? null, cwd: childCwd } };
    case "get_cwd":
      return { type: "response", id: msg.id, command: "get_cwd", success: true, data: { cwd: childCwd } };
    case "get_server_info":
      return {
        type: "response", id: msg.id, command: "get_server_info", success: true,
        data: {
          piBin,
          childCwd,
          childRunning: !!child,
          childExitInfo,
          sessionDir: SESSION_DIR,
          settingsFile: SETTINGS_FILE,
          port: PORT,
        },
      };
    case "get_settings":
      return { type: "response", id: msg.id, command: "get_settings", success: true, data: { path: SETTINGS_FILE, settings: readSettings() } };
    case "get_context_file":
      return { type: "response", id: msg.id, command: "get_context_file", success: true, data: readContextFile(msg.cwd ?? childCwd) };
    case "set_context_file":
      try {
        const info = writeContextFile(msg.cwd ?? childCwd, msg.content);
        return { type: "response", id: msg.id, command: "set_context_file", success: true, data: info };
      } catch (err) {
        return { type: "response", id: msg.id, command: "set_context_file", success: false, error: err.message };
      }
    case "list_workspace_files": {
      try {
        const files = listWorkspaceFiles();
        return { type: "response", id: msg.id, command: "list_workspace_files", success: true, data: { files } };
      } catch (err) {
        return { type: "response", id: msg.id, command: "list_workspace_files", success: false, error: err.message };
      }
    }
    case "get_project_trust":
      return {
        type: "response", id: msg.id, command: "get_project_trust", success: true,
        data: { cwd: childCwd, decision: trustStore.get(childCwd) },
      };
    case "set_project_trust": {
      const decision = msg.decision;
      if (decision !== true && decision !== false && decision !== null) {
        return { type: "response", id: msg.id, command: "set_project_trust", success: false, error: "decision 必须是 true/false/null" };
      }
      trustStore.set(childCwd, decision);
      return {
        type: "response", id: msg.id, command: "set_project_trust", success: true,
        data: { cwd: childCwd, decision: trustStore.get(childCwd) },
      };
    }
    case "set_settings": {
      const patch = msg.settings ?? {};
      const current = readSettings();
      if (isPlainObject(current)) {
        writeSettings(deepMerge(current, patch));
      } else {
        writeSettings(patch);
      }
      return { type: "response", id: msg.id, command: "set_settings", success: true, data: { path: SETTINGS_FILE, settings: readSettings() } };
    }
    case "list_providers":
      try {
        const providers = await listProviders();
        return { type: "response", id: msg.id, command: "list_providers", success: true, data: { providers } };
      } catch (err) {
        return { type: "response", id: msg.id, command: "list_providers", success: false, error: err.message };
      }
    case "get_provider_auth":
      try {
        const status = await providerAuthStatus(String(msg.provider ?? ""));
        return { type: "response", id: msg.id, command: "get_provider_auth", success: true, data: status };
      } catch (err) {
        return { type: "response", id: msg.id, command: "get_provider_auth", success: false, error: err.message };
      }
    case "set_provider_api_key":
      try {
        const status = await setProviderApiKey(String(msg.provider ?? ""), String(msg.apiKey ?? ""));
        return { type: "response", id: msg.id, command: "set_provider_api_key", success: true, data: status };
      } catch (err) {
        return { type: "response", id: msg.id, command: "set_provider_api_key", success: false, error: err.message };
      }
    case "remove_provider_api_key":
      try {
        const status = await removeProviderApiKey(String(msg.provider ?? ""));
        return { type: "response", id: msg.id, command: "remove_provider_api_key", success: true, data: status };
      } catch (err) {
        return { type: "response", id: msg.id, command: "remove_provider_api_key", success: false, error: err.message };
      }
    case "get_models":
      try {
        const models = await listModels(msg.provider ? String(msg.provider) : undefined);
        return { type: "response", id: msg.id, command: "get_models", success: true, data: { models } };
      } catch (err) {
        return { type: "response", id: msg.id, command: "get_models", success: false, error: err.message };
      }
    case "refresh_models":
      try {
        const result = await refreshModels();
        return { type: "response", id: msg.id, command: "refresh_models", success: true, data: result };
      } catch (err) {
        return { type: "response", id: msg.id, command: "refresh_models", success: false, error: err.message };
      }
    case "list_sessions":
      return { type: "response", id: msg.id, command: "list_sessions", success: true, data: { sessions: listSessions() } };
    case "delete_session":
      try {
        const info = deleteSession(msg.sessionPath);
        return { type: "response", id: msg.id, command: "delete_session", success: true, data: { ...info, sessions: listSessions() } };
      } catch (err) {
        return { type: "response", id: msg.id, command: "delete_session", success: false, error: err.message };
      }
    case "restart": {
      const info = restartPi(msg.cwd);
      return { type: "response", id: msg.id, command: "restart", success: true, data: info };
    }
    default:
      return null;
  }
}

wss.on("connection", (ws) => {
  clients.add(ws);
  log(`前端已连接（${clients.size} 个客户端）`);

  ws.on("message", async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString("utf8"));
    } catch {
      ws.send(JSON.stringify({ type: "response", command: "parse", success: false, error: "Invalid JSON" }));
      return;
    }

    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;

    if (SERVER_COMMANDS.has(msg.type)) {
      const resp = await handleServerCommand(msg);
      if (resp) ws.send(JSON.stringify(resp));
      return;
    }

    // RPC 命令透传：pi RPC 协议要求 stdin 每行一个 JSON
    if (!writeToPi(msg)) {
      ws.send(JSON.stringify({
        type: "response",
        id: msg.id,
        command: msg.type,
        success: false,
        error: "pi 子进程未运行，请先调用 restart",
      }));
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    log(`前端断开（${clients.size} 个客户端）`);
  });

  ws.on("error", () => {
    clients.delete(ws);
  });
});

wss.on("error", (err) => {
  log("WebSocket 服务错误:", err.message);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------

spawnPi();
log(`Pi Agent Bridge 已启动: ws://127.0.0.1:${PORT}`);
log(`会话目录: ${SESSION_DIR}`);

// 优雅退出
process.on("SIGINT", () => {
  killPi();
  process.exit(0);
});
process.on("SIGTERM", () => {
  killPi();
  process.exit(0);
});
