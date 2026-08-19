/**
 * Pi Agent 数据类型
 *
 * 对应 RPC 文档中的 Model / AgentMessage / events / commands。
 */

export interface PiCost {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total?: number;
}

export interface PiUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens?: number;
  cost?: PiCost;
}

export interface PiModel {
  id: string;
  name: string;
  api?: string;
  provider: string;
  baseUrl?: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
  cost?: PiCost;
}

export interface PiCommand {
  name: string;
  description?: string;
  source?: "extension" | "prompt" | "skill";
  location?: "user" | "project" | "path";
  path?: string;
  sourceInfo?: Record<string, unknown>;
}

export interface PiProviderInfo {
  id: string;
  name: string;
  baseUrl: string | null;
  apiKeyAuth: { name: string } | null;
  oauthAuth: { name: string; isSubscription: boolean } | null;
  modelCount: number;
}

export interface PiProviderAuthStatus {
  configured: boolean;
  check: { source: string | null; type: string } | null;
  usingOAuth: boolean;
  usingSubscription: boolean;
  error?: string;
}

export interface PiCatalogModel {
  id: string;
  name: string;
  provider: string;
  api: string;
  baseUrl: string | null;
  reasoning: boolean;
  input: string[];
  contextWindow: number | null;
  maxTokens: number | null;
  cost: PiCost | null;
}

export interface SessionInfo {
  id: string;
  path: string;
  cwd: string;
  timestamp: string;
  title: string;
  messageCount: number;
}

export interface PiSessionStats {
  sessionFile?: string;
  sessionId?: string;
  userMessages?: number;
  assistantMessages?: number;
  toolCalls?: number;
  toolResults?: number;
  totalMessages?: number;
  tokens?: PiUsage;
  cost?: number;
  contextUsage?: {
    tokens: number | null;
    contextWindow: number;
    percent: number | null;
  };
}

export type PiContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> | string };

export type UIMessageRole = "user" | "assistant" | "toolResult" | "bashExecution";

export interface UIMessage {
  id: string;
  role: UIMessageRole;
  /** user 消息文本 / assistant 文本拼接 / 工具结果文本 */
  text: string;
  /** assistant 内容块 */
  blocks: PiContentBlock[];
  toolName?: string;
  toolCallId?: string;
  args?: Record<string, unknown>;
  resultText?: string;
  isError?: boolean;
  command?: string;
  exitCode?: number;
  model?: string;
  provider?: string;
  timestamp?: number;
  usage?: PiUsage;
}

export interface ToolActivity {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  output: string;
  isError: boolean;
  status: "running" | "done";
}

/** 直接 RPC bash 命令的完整返回结果 */
export interface BashResult {
  output: string;
  exitCode: number;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath: string | null;
}

export interface ExtensionUiRequest {
  id: string;
  method: "select" | "confirm" | "input" | "editor" | "notify" | "setStatus" | "setWidget" | "setTitle" | "set_editor_text";
  title?: string;
  options?: string[];
  message?: string;
  placeholder?: string;
  prefill?: string;
  notifyType?: "info" | "warning" | "error";
  statusKey?: string;
  statusText?: string;
  widgetKey?: string;
  widgetLines?: string[];
  widgetPlacement?: "aboveEditor" | "belowEditor";
  text?: string;
  timeout?: number;
}

export interface QueueState {
  steering: string[];
  followUp: string[];
}

// ---------------------------------------------------------------------------
// Pi 设置（~/.pi/agent/settings.json）
// ---------------------------------------------------------------------------

export interface PiSettings {
  defaultProvider?: string;
  defaultModel?: string;
  defaultThinkingLevel?: string;
  hideThinkingBlock?: boolean;
  showCacheMissNotices?: boolean;
  thinkingBudgets?: Record<string, number>;
  theme?: string;
  externalEditor?: string;
  quietStartup?: boolean;
  defaultProjectTrust?: "ask" | "always" | "never";
  collapseChangelog?: boolean;
  enableInstallTelemetry?: boolean;
  enableAnalytics?: boolean;
  trackingId?: string;
  doubleEscapeAction?: "tree" | "fork" | "none";
  treeFilterMode?: "default" | "no-tools" | "user-only" | "labeled-only" | "all";
  editorPaddingX?: number;
  outputPad?: number;
  autocompleteMaxVisible?: number;
  showHardwareCursor?: boolean;
  tuiMode?: "regular" | "fullscreen";
  fullscreenExitOutput?: "transcript" | "resume-hint";
  fullscreenScrollbar?: "auto" | "always" | "hidden";
  httpProxy?: string;
  warnings?: { anthropicExtraUsage?: boolean };
  compaction?: { enabled?: boolean; reserveTokens?: number; keepRecentTokens?: number };
  branchSummary?: { reserveTokens?: number; skipPrompt?: boolean };
  retry?: {
    enabled?: boolean;
    maxRetries?: number;
    baseDelayMs?: number;
    provider?: { timeoutMs?: number; maxRetries?: number; maxRetryDelayMs?: number };
  };
  steeringMode?: "all" | "one-at-a-time";
  followUpMode?: "all" | "one-at-a-time";
  transport?: "sse" | "websocket" | "websocket-cached" | "auto";
  httpIdleTimeoutMs?: number;
  websocketConnectTimeoutMs?: number;
  terminal?: { showImages?: boolean; imageWidthCells?: number; clearOnShrink?: boolean };
  images?: { autoResize?: boolean; blockImages?: boolean };
  shellPath?: string;
  shellCommandPrefix?: string;
  npmCommand?: string[];
  defaultTools?: string[];
  sessionDir?: string;
  enabledModels?: string[];
  markdown?: { codeBlockIndent?: string; mermaid?: "off" | "final" | "streaming" };
  packages?: Array<string | Record<string, unknown>>;
  extensions?: string[];
  skills?: string[];
  prompts?: string[];
  themes?: string[];
  enableSkillCommands?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// 解析工具：把 RPC AgentMessage 转换为 UIMessage
// ---------------------------------------------------------------------------

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Array<Record<string, unknown>>)
      .map((b) => {
        if (b.type === "text") return String(b.text ?? "");
        if (b.type === "thinking") return String(b.thinking ?? "");
        if (b.type === "toolCall") return `[调用工具 ${String(b.name ?? "")}]`;
        return "";
      })
      .filter(Boolean)
      .join("");
  }
  return "";
}

export function parseAgentMessage(raw: Record<string, unknown>, fallbackId?: string): UIMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const role = raw.role as UIMessageRole | undefined;
  if (!role) return null;
  const id = String((raw.id as string) ?? fallbackId ?? Math.random().toString(36).slice(2));
  const base: UIMessage = {
    id,
    role,
    text: "",
    blocks: [],
    timestamp: typeof raw.timestamp === "number" ? (raw.timestamp as number) : undefined,
  };

  if (role === "user") {
    base.text = contentToText(raw.content);
  } else if (role === "assistant") {
    const content = raw.content;
    if (Array.isArray(content)) {
      const blocks: PiContentBlock[] = [];
      for (const b of content as Array<Record<string, unknown>>) {
        if (b.type === "text") {
          blocks.push({ type: "text", text: String(b.text ?? "") });
        } else if (b.type === "thinking") {
          blocks.push({ type: "thinking", thinking: String(b.thinking ?? "") });
        } else if (b.type === "toolCall" || b.type === "toolCallRequest") {
          blocks.push({
            type: "toolCall",
            id: String(b.id ?? ""),
            name: String(b.name ?? "unknown"),
            arguments: (b.arguments ?? b.args ?? {}) as Record<string, unknown>,
          });
        }
      }
      base.blocks = blocks;
      base.text = blocks
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("");
    }
    base.model = typeof raw.model === "string" ? (raw.model as string) : undefined;
    base.provider = typeof raw.provider === "string" ? (raw.provider as string) : undefined;
    base.usage = raw.usage as PiUsage | undefined;
  } else if (role === "toolResult") {
    base.toolName = typeof raw.toolName === "string" ? (raw.toolName as string) : undefined;
    base.toolCallId = typeof raw.toolCallId === "string" ? (raw.toolCallId as string) : undefined;
    base.resultText = contentToText(raw.content);
    base.text = base.resultText ?? "";
    base.isError = Boolean(raw.isError);
  } else if (role === "bashExecution") {
    base.command = typeof raw.command === "string" ? (raw.command as string) : undefined;
    base.exitCode = typeof raw.exitCode === "number" ? (raw.exitCode as number) : undefined;
    base.text = typeof raw.output === "string" ? (raw.output as string) : "";
  }

  return base;
}

export function parseAgentMessages(list: unknown): UIMessage[] {
  if (!Array.isArray(list)) return [];
  const out: UIMessage[] = [];
  let i = 0;
  for (const item of list) {
    const msg = parseAgentMessage(item as Record<string, unknown>, `m-${i++}`);
    if (msg) out.push(msg);
  }
  return out;
}

export function toolResultText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  const content = r.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Array<Record<string, unknown>>)
      .map((b) => String(b.text ?? b.output ?? ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}
