import { create } from "zustand";
import { piClient } from "@/lib/pi-client";
import {
  parseAgentMessage,
  parseAgentMessages,
  toolResultText,
  type BashResult,
  type ExtensionUiRequest,
  type PiCatalogModel,
  type PiCommand,
  type PiImage,
  type PiModel,
  type PiProviderAuthStatus,
  type PiProviderInfo,
  type PiSessionStats,
  type PiSettings,
  type QueueState,
  type SessionInfo,
  type SessionTreeNode,
  type ToolActivity,
  type UIMessage,
} from "@/lib/pi-types";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface PiState {
  // 连接
  status: ConnectionStatus;
  lastError: string | null;
  cwd: string;

  // pi 数据
  models: PiModel[];
  commands: PiCommand[];
  sessions: SessionInfo[];
  messages: UIMessage[];
  sessionId: string | null;
  sessionFile: string | null;
  sessionName: string | null;
  model: PiModel | null;
  thinkingLevel: string;
  availableThinkingLevels: string[];
  isStreaming: boolean;
  isCompacting: boolean;
  autoCompactionEnabled: boolean;
  /** 自动重试进度：attempt / maxAttempts（未重试时 null） */
  retryInfo: { attempt: number; maxAttempts: number } | null;
  steeringMode: string;
  followUpMode: string;
  queue: QueueState;
  stats: PiSessionStats | null;
  activeTools: ToolActivity[];
  liveMessage: UIMessage | null;
  /** 直接 RPC bash 命令的实时流式输出 */
  activeBashOutput: string | null;
  /** 扩展通过 set_editor_text 预填输入框的内容 */
  editorPrefill: string | null;
  /** 扩展 setStatus 状态条目（statusKey → statusText） */
  extensionStatus: Record<string, string>;
  /** 扩展 setWidget 文本块（widgetKey → lines） */
  extensionWidgets: Record<string, { lines: string[]; placement: "aboveEditor" | "belowEditor" }>;
  /** 扩展 setTitle 请求的窗口标题 */
  extensionTitle: string | null;
  extensionUi: ExtensionUiRequest | null;
  notice: string | null;
  settings: PiSettings | null;
  settingsPath: string | null;
  providers: PiProviderInfo[];
  providerAuth: Record<string, PiProviderAuthStatus>;
  catalogModels: PiCatalogModel[];
  modelsRefreshing: boolean;

  // UI 状态
  isSidebarOpen: boolean;
  isCommandPaletteOpen: boolean;
  isSettingsOpen: boolean;
  isModelDialogOpen: boolean;
  isTreeDialogOpen: boolean;
  settingsTheme: "light" | "dark" | "system";
  setSettingsTheme: (theme: "light" | "dark" | "system") => void;
  setModelDialogOpen: (open: boolean) => void;
  setTreeDialogOpen: (open: boolean) => void;
  /** 流式输出：开启时逐字显示，关闭时等待完整回复再显示 */
  streamingOutput: boolean;
  setStreamingOutput: (enabled: boolean) => void;

  // 动作
  connect: (url: string) => void;
  disconnect: () => void;
  refreshAll: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  deleteSession: (path: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
  saveSettings: (patch: Record<string, unknown>) => Promise<void>;
  refreshProviders: () => Promise<void>;
  refreshCatalogModels: () => Promise<void>;
  checkProviderAuth: (provider: string) => Promise<void>;
  setProviderApiKey: (provider: string, apiKey: string) => Promise<boolean>;
  removeProviderApiKey: (provider: string) => Promise<void>;
  sendPrompt: (text: string, opts?: { streamingBehavior?: "steer" | "followUp"; images?: PiImage[] }) => Promise<boolean>;
  steer: (text: string, images?: PiImage[]) => void;
  followUp: (text: string, images?: PiImage[]) => void;
  abort: () => void;
  setModel: (provider: string, modelId: string) => Promise<void>;
  cycleModel: () => Promise<void>;
  setThinkingLevel: (level: string) => Promise<void>;
  cycleThinkingLevel: () => Promise<void>;
  getAvailableThinkingLevels: () => Promise<void>;
  newSession: () => Promise<void>;
  switchSession: (path: string) => Promise<void>;
  setSessionName: (name: string) => Promise<void>;
  setWorkingDir: (cwd: string) => Promise<void>;
  restartPi: () => Promise<void>;
  compact: (customInstructions?: string) => Promise<void>;
  setAutoCompaction: (enabled: boolean) => Promise<void>;
  setAutoRetry: (enabled: boolean) => Promise<void>;
  abortRetry: () => void;
  fork: (entryId: string) => Promise<{ text?: string; cancelled?: boolean } | null>;
  clone: () => Promise<boolean>;
  getForkMessages: () => Promise<Array<{ entryId: string; text: string }>>;
  /** 从某条消息（user 或 assistant）fork 并重发其对应的用户提示 */
  regenerateMessage: (messageId: string) => Promise<boolean>;
  /** 回退到某条用户消息之前（fork 但不重发，供用户重新输入） */
  rollbackToMessage: (messageId: string) => Promise<boolean>;
  getTree: () => Promise<{ tree: SessionTreeNode[]; leafId: string | null } | null>;
  getEntries: (since?: string) => Promise<unknown>;
  exportHtml: (outputPath?: string) => Promise<string | null>;
  setSteeringMode: (mode: "all" | "one-at-a-time") => Promise<void>;
  setFollowUpMode: (mode: "all" | "one-at-a-time") => Promise<void>;
  bash: (command: string) => Promise<BashResult | null>;
  abortBash: () => void;
  getLastAssistantText: () => Promise<string | null>;
  getContextFile: () => Promise<{ path: string; content: string } | null>;
  setContextFile: (content: string) => Promise<{ path: string } | null>;
  listWorkspaceFiles: () => Promise<string[]>;
  getProjectTrust: () => Promise<boolean | null>;
  setProjectTrust: (decision: boolean | null) => Promise<void>;
  respondExtensionUi: (response: Record<string, unknown>) => void;
  dismissExtensionUi: () => void;
  clearNotice: () => void;
  setNotice: (text: string | null) => void;
  consumeEditorPrefill: () => void;

  setSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
}

const initialQueue: QueueState = { steering: [], followUp: [] };

function toolArgsToString(args: unknown): string {
  if (!args) return "";
  if (typeof args === "string") return args;
  try {
    return JSON.stringify(args);
  } catch {
    return String(args);
  }
}

export const useChatStore = create<PiState>()((set, get) => {
  // 是否已在本轮应用生命周期内尝试过自动恢复上次会话（仅启动时一次）
  let autoResumeDone = false;

  // 事件订阅
  const onStatus = (ev: Record<string, unknown>) => {
    const status = ev.status as ConnectionStatus;
    set({ status, lastError: status === "error" ? "连接发生错误" : get().lastError });
    if (status === "connected") {
      void get()
        .refreshAll()
        .then(() => {
          if (autoResumeDone) return;
          autoResumeDone = true;
          const s = get();
          // 当前是空会话且存在历史会话时，自动切换到最近一次会话
          if (s.messages.length === 0 && s.sessions.length > 0) {
            void s.switchSession(s.sessions[0].path);
          }
        });
    }
  };

  const onAgentStart = () => {
    set({ isStreaming: true, activeTools: [], liveMessage: null });
  };

  const onAgentEnd = () => {
    // 单次底层 run 结束；可能还有 retry / compaction / queued continuation
  };

  const onTurnEnd = (ev: Record<string, unknown>) => {
    // turn 结束：把完整的 assistant 消息落定到消息列表（去重）
    const raw = ev.message as Record<string, unknown> | undefined;
    const msg = raw ? parseAgentMessage(raw) : null;
    if (msg && msg.role === "assistant") {
      set((s) => ({
        liveMessage: null,
        messages: s.messages.some((m) => m.id === msg.id) ? s.messages : [...s.messages, msg],
      }));
    }
  };

  const onAgentSettled = () => {
    set({ isStreaming: false, liveMessage: null, activeTools: [], activeBashOutput: null });
    get().refreshAll();
  };

  const onBashUpdate = (ev: Record<string, unknown>) => {
    const delta = String(ev.delta ?? "");
    set((s) => ({ activeBashOutput: (s.activeBashOutput ?? "") + delta }));
  };

  const onAutoRetryStart = (ev: Record<string, unknown>) => {
    const attempt = Number(ev.attempt ?? 1) || 1;
    const maxRaw = Number(ev.maxAttempts ?? NaN);
    const max = Number.isFinite(maxRaw) ? maxRaw : attempt; // 避免 NaN
    set({ notice: `瞬时错误，自动重试（${attempt}/${max}）…`, retryInfo: { attempt, maxAttempts: max } });
  };

  const onAutoRetryEnd = (ev: Record<string, unknown>) => {
    if (ev.success === false) {
      const finalError = String(ev.finalError ?? "未知错误");
      set({ lastError: `重试失败：${finalError}` });
    }
    set({ notice: null, retryInfo: null });
  };

  const onSummarizationRetryScheduled = (ev: Record<string, unknown>) => {
    const attempt = Number(ev.attempt ?? 1);
    const max = Number(ev.maxAttempts ?? "?");
    set({ notice: `摘要生成失败，稍后重试（${attempt}/${max}）…` });
  };

  const onSummarizationRetryAttemptStart = () => {
    set({ notice: "摘要生成重试中…" });
  };

  const onSummarizationRetryFinished = () => {
    set({ notice: null });
  };

  const onMessageStart = (ev: Record<string, unknown>) => {
    const raw = ev.message as Record<string, unknown> | undefined;
    if (!raw) return;
    const msg = parseAgentMessage(raw);
    if (msg && msg.role === "assistant") {
      set({ liveMessage: msg });
    }
  };

  const onMessageUpdate = (ev: Record<string, unknown>) => {
    // 流式关闭时：不累积增量，等 message_end 一次性落定完整消息，避免渲染残缺 markdown
    if (!get().streamingOutput) return;
    const e = (ev.assistantMessageEvent ?? {}) as Record<string, unknown>;
    const deltaType = e.type as string | undefined;
    const live = get().liveMessage;
    if (!live) return;

    const blocks = [...live.blocks];
    const contentIndex = typeof e.contentIndex === "number" ? (e.contentIndex as number) : 0;

    if (deltaType === "text_delta") {
      const delta = String(e.delta ?? "");
      if (blocks[contentIndex]?.type === "text") {
        blocks[contentIndex] = { type: "text", text: (blocks[contentIndex] as { text: string }).text + delta };
      } else {
        blocks[contentIndex] = { type: "text", text: delta };
      }
      set({
        liveMessage: {
          ...live,
          blocks,
          text: blocks.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join(""),
        },
      });
    } else if (deltaType === "thinking_delta") {
      const delta = String(e.delta ?? "");
      const idx = blocks.findIndex((b) => b.type === "thinking");
      if (idx >= 0) {
        blocks[idx] = { type: "thinking", thinking: (blocks[idx] as { thinking: string }).thinking + delta };
      } else {
        blocks.push({ type: "thinking", thinking: delta });
      }
      set({ liveMessage: { ...live, blocks } });
    } else if (deltaType === "toolcall_start") {
      blocks.push({
        type: "toolCall",
        id: String(e.toolCallId ?? e.id ?? Math.random().toString(36).slice(2)),
        name: String(e.toolName ?? e.name ?? "unknown"),
        arguments: (e.arguments ?? e.args ?? {}) as Record<string, unknown>,
      });
      set({ liveMessage: { ...live, blocks } });
    } else if (deltaType === "toolcall_delta") {
      // 参数 delta 为字符串，追加到最后一个 toolCall 块
      const lastIdx = blocks.length - 1;
      if (lastIdx >= 0 && blocks[lastIdx].type === "toolCall") {
        const delta = String(e.delta ?? "");
        const cur = blocks[lastIdx] as { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> | string };
        if (typeof cur.arguments === "string") {
          cur.arguments = cur.arguments + delta;
        } else {
          cur.arguments = (cur.arguments ? JSON.stringify(cur.arguments) : "") + delta;
        }
        blocks[lastIdx] = cur;
        set({ liveMessage: { ...live, blocks } });
      }
    } else if (deltaType === "toolcall_end") {
      const toolCall = (e.toolCall ?? {}) as Record<string, unknown>;
      // 用完整 toolCall 替换最后一个匹配块
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        if (b.type === "toolCall" && (b.id === toolCall.id || i === blocks.length - 1)) {
          blocks[i] = {
            type: "toolCall",
            id: String(toolCall.id ?? b.id),
            name: String(toolCall.name ?? b.name),
            arguments: (toolCall.arguments ?? toolCall.args ?? {}) as Record<string, unknown>,
          };
          break;
        }
      }
      set({ liveMessage: { ...live, blocks } });
    } else if (deltaType === "text_start" || deltaType === "thinking_start") {
      // 忽略开始标记，delta 会随后到达
    } else if (deltaType === "text_end") {
      const content = String(e.content ?? "");
      if (content) {
        blocks[contentIndex] = { type: "text", text: content };
        set({ liveMessage: { ...live, blocks } });
      }
    }
  };

  const onMessageEnd = (ev: Record<string, unknown>) => {
    const raw = ev.message as Record<string, unknown> | undefined;
    if (!raw) return;
    const msg = parseAgentMessage(raw);
    if (msg && msg.role === "assistant") {
      set({ liveMessage: msg });
    }
  };

  const onToolStart = (ev: Record<string, unknown>) => {
    const activity: ToolActivity = {
      toolCallId: String(ev.toolCallId ?? ""),
      toolName: String(ev.toolName ?? "tool"),
      args: (ev.args ?? {}) as Record<string, unknown>,
      output: "",
      isError: false,
      status: "running",
    };
    set((s) => ({ activeTools: [...s.activeTools.filter((t) => t.toolCallId !== activity.toolCallId), activity] }));
  };

  const onToolUpdate = (ev: Record<string, unknown>) => {
    const toolCallId = String(ev.toolCallId ?? "");
    const output = toolResultText(ev.partialResult);
    set((s) => ({
      activeTools: s.activeTools.map((t) => (t.toolCallId === toolCallId ? { ...t, output, status: "running" } : t)),
    }));
  };

  const onToolEnd = (ev: Record<string, unknown>) => {
    const toolCallId = String(ev.toolCallId ?? "");
    const toolName = String(ev.toolName ?? "tool");
    const args = (ev.args ?? {}) as Record<string, unknown>;
    const result = ev.result;
    const output = toolResultText(result);
    const isError = Boolean(ev.isError);
    // edit 工具的展示 diff（来自 result.details.diff / patch）
    const details = (result && typeof result === "object" ? (result as Record<string, unknown>).details : undefined) as
      | Record<string, unknown>
      | undefined;
    const diff = details && typeof details.diff === "string" ? (details.diff as string) : undefined;
    const patch = details && typeof details.patch === "string" ? (details.patch as string) : undefined;
    set((s) => ({
      activeTools: s.activeTools.map((t) =>
        t.toolCallId === toolCallId ? { ...t, output, isError, status: "done" as const, diff, patch } : t
      ),
      messages: [
        ...s.messages,
        {
          id: `tool-${toolCallId}`,
          role: "toolResult" as const,
          text: output,
          resultText: output,
          blocks: [],
          toolName,
          toolCallId,
          args,
          isError,
          diff,
        },
      ],
    }));
  };

  const onQueueUpdate = (ev: Record<string, unknown>) => {
    set({
      queue: {
        steering: Array.isArray(ev.steering) ? (ev.steering as string[]) : [],
        followUp: Array.isArray(ev.followUp) ? (ev.followUp as string[]) : [],
      },
    });
  };

  const onCompactionStart = () => set({ isCompacting: true });
  const onCompactionEnd = () => set({ isCompacting: false });

  const onExtensionUi = (ev: Record<string, unknown>) => {
    const method = String(ev.method ?? "");
    if (["select", "confirm", "input", "editor"].includes(method)) {
      set({ extensionUi: ev as unknown as ExtensionUiRequest });
    } else if (method === "notify") {
      const type = String(ev.notifyType ?? "info");
      const prefix = type === "error" ? "⚠️" : type === "warning" ? "⚠" : "ℹ️";
      set({ notice: `${prefix} ${String(ev.message ?? "")}` });
      setTimeout(() => {
        if (get().notice) set({ notice: null });
      }, 4000);
    } else if (method === "set_editor_text") {
      set({ editorPrefill: String(ev.text ?? "") });
    } else if (method === "setStatus") {
      const key = String(ev.statusKey ?? "");
      if (!key) return;
      const text = ev.statusText;
      set((s) => {
        const next = { ...s.extensionStatus };
        if (text == null || String(text) === "") delete next[key];
        else next[key] = String(text);
        return { extensionStatus: next };
      });
    } else if (method === "setWidget") {
      const key = String(ev.widgetKey ?? "");
      if (!key) return;
      const lines = ev.widgetLines;
      set((s) => {
        const next = { ...s.extensionWidgets };
        if (!Array.isArray(lines)) {
          delete next[key];
        } else {
          next[key] = {
            lines: lines.map(String),
            placement: ev.widgetPlacement === "belowEditor" ? "belowEditor" : "aboveEditor",
          };
        }
        return { extensionWidgets: next };
      });
    } else if (method === "setTitle") {
      set({ extensionTitle: ev.title == null ? null : String(ev.title) });
    }
  };

  const onExtensionError = (ev: Record<string, unknown>) => {
    const extensionPath = String(ev.extensionPath ?? "?");
    const error = String(ev.error ?? "未知错误");
    set({ lastError: `扩展错误（${extensionPath}）：${error}` });
  };

  const onStderr = (ev: Record<string, unknown>) => {
    const data = String(ev.data ?? "");
    if (data.trim()) console.warn("[pi stderr]", data);
  };

  const onAgentExit = (ev: Record<string, unknown>) => {
    set({ status: "error", lastError: `pi 进程退出（code=${String(ev.code ?? "?")}），正在尝试重启…`, isStreaming: false });
    setTimeout(() => {
      piClient.request("restart").then(() => {
        set({ status: "connected" });
        get().refreshAll();
      });
    }, 1200);
  };

  // 绑定事件
  const unsubs = [
    piClient.on("status", onStatus),
    piClient.on("agent_start", onAgentStart),
    piClient.on("agent_end", onAgentEnd),
    piClient.on("agent_settled", onAgentSettled),
    piClient.on("turn_start", onAgentStart),
    piClient.on("turn_end", onTurnEnd),
    piClient.on("message_start", onMessageStart),
    piClient.on("message_update", onMessageUpdate),
    piClient.on("message_end", onMessageEnd),
    piClient.on("bash_execution_update", onBashUpdate),
    piClient.on("tool_execution_start", onToolStart),
    piClient.on("tool_execution_update", onToolUpdate),
    piClient.on("tool_execution_end", onToolEnd),
    piClient.on("queue_update", onQueueUpdate),
    piClient.on("compaction_start", onCompactionStart),
    piClient.on("compaction_end", onCompactionEnd),
    piClient.on("auto_retry_start", onAutoRetryStart),
    piClient.on("auto_retry_end", onAutoRetryEnd),
    piClient.on("summarization_retry_scheduled", onSummarizationRetryScheduled),
    piClient.on("summarization_retry_attempt_start", onSummarizationRetryAttemptStart),
    piClient.on("summarization_retry_finished", onSummarizationRetryFinished),
    piClient.on("extension_ui_request", onExtensionUi),
    piClient.on("extension_error", onExtensionError),
    piClient.on("stderr", onStderr),
    piClient.on("agent_exit", onAgentExit),
  ];
  void unsubs;

  return {
    status: "disconnected",
    lastError: null,
    cwd: "",

    models: [],
    commands: [],
    sessions: [],
    messages: [],
    sessionId: null,
    sessionFile: null,
    sessionName: null,
    model: null,
    thinkingLevel: "off",
    availableThinkingLevels: [],
    isStreaming: false,
    isCompacting: false,
    autoCompactionEnabled: true,
    retryInfo: null,
    steeringMode: "one-at-a-time",
    followUpMode: "one-at-a-time",
    queue: initialQueue,
    stats: null,
    activeTools: [],
    liveMessage: null,
    activeBashOutput: null,
    editorPrefill: null,
    extensionStatus: {},
    extensionWidgets: {},
    extensionTitle: null,
    extensionUi: null,
    notice: null,
    settings: null,
    settingsPath: null,
    providers: [],
    providerAuth: {},
    catalogModels: [],
    modelsRefreshing: false,

    isSidebarOpen: false,
    isCommandPaletteOpen: false,
    isSettingsOpen: false,
    isModelDialogOpen: false,
    isTreeDialogOpen: false,
    settingsTheme: "system",
    streamingOutput: true,

    connect: (url) => {
      piClient.connect(url);
    },

    disconnect: () => {
      piClient.close();
      set({ status: "disconnected" });
    },

    refreshAll: async () => {
      const [stateRes, messagesRes, modelsRes, commandsRes, sessionsRes, statsRes, settingsRes, providersRes, thinkingRes] = await Promise.all([
        piClient.request("get_state"),
        piClient.request("get_messages"),
        piClient.request("get_available_models"),
        piClient.request("get_commands"),
        piClient.request("list_sessions"),
        piClient.request("get_session_stats"),
        piClient.request("get_settings"),
        piClient.request("list_providers"),
        piClient.request("get_available_thinking_levels"),
      ]);

      const stateData = (stateRes.data ?? {}) as Record<string, unknown>;
      const messagesData = (messagesRes.data ?? {}) as Record<string, unknown>;
      const modelsData = (modelsRes.data ?? {}) as Record<string, unknown>;
      const commandsData = (commandsRes.data ?? {}) as Record<string, unknown>;
      const sessionsData = (sessionsRes.data ?? {}) as Record<string, unknown>;
      const statsData = (statsRes.data ?? {}) as Record<string, unknown>;
      const settingsData = (settingsRes.data ?? {}) as Record<string, unknown>;
      const providersData = (providersRes.data ?? {}) as Record<string, unknown>;
      const thinkingData = (thinkingRes.data ?? {}) as Record<string, unknown>;

      const model = stateData.model as PiModel | null;
      const levels = Array.isArray(thinkingData.levels) ? (thinkingData.levels as string[]) : [];

      set({
        sessionId: (stateData.sessionId as string) ?? null,
        sessionFile: (stateData.sessionFile as string) ?? null,
        sessionName: (stateData.sessionName as string) ?? null,
        model,
        thinkingLevel: (stateData.thinkingLevel as string) ?? "off",
        availableThinkingLevels: levels,
        isStreaming: Boolean(stateData.isStreaming),
        isCompacting: Boolean(stateData.isCompacting),
        autoCompactionEnabled: Boolean(stateData.autoCompactionEnabled),
        steeringMode: (stateData.steeringMode as string) ?? "one-at-a-time",
        followUpMode: (stateData.followUpMode as string) ?? "one-at-a-time",
        messages: parseAgentMessages(messagesData.messages),
        models: Array.isArray(modelsData.models) ? (modelsData.models as PiModel[]) : [],
        commands: Array.isArray(commandsData.commands) ? (commandsData.commands as PiCommand[]) : [],
        sessions: Array.isArray(sessionsData.sessions) ? (sessionsData.sessions as SessionInfo[]) : [],
        stats: statsRes.success ? (statsData as PiSessionStats) : null,
        settings: (settingsData.settings as PiSettings) ?? null,
        settingsPath: (settingsData.path as string) ?? null,
        providers: (providersData.providers as PiProviderInfo[]) ?? [],
      });

      const serverInfo = await piClient.request("get_server_info");
      if (serverInfo.success && serverInfo.data) {
        set({ cwd: String(serverInfo.data.childCwd ?? "") });
      }
    },

    refreshSessions: async () => {
      const res = await piClient.request("list_sessions");
      if (res.success && res.data) {
        set({ sessions: (res.data.sessions as SessionInfo[]) ?? [] });
      }
    },

    deleteSession: async (path) => {
      const res = await piClient.request("delete_session", { sessionPath: path });
      if (res.success && res.data) {
        const remaining = (res.data.sessions as SessionInfo[]) ?? [];
        set({ sessions: remaining });
        // 若删除的是当前会话，切换到新会话并清空消息
        if (get().sessionFile === path) {
          set({ sessionId: null, sessionFile: null, sessionName: null, messages: [], activeTools: [], liveMessage: null });
          await get().newSession();
        }
      } else {
        set({ lastError: res.error ?? "删除会话失败" });
      }
    },

    refreshSettings: async () => {
      const res = await piClient.request("get_settings");
      if (res.success && res.data) {
        set({
          settings: (res.data.settings as PiSettings) ?? null,
          settingsPath: (res.data.path as string) ?? null,
        });
      }
    },

    saveSettings: async (patch) => {
      const res = await piClient.request("set_settings", { settings: patch });
      if (res.success && res.data) {
        set({
          settings: (res.data.settings as PiSettings) ?? null,
          settingsPath: (res.data.path as string) ?? null,
        });
      } else {
        set({ lastError: res.error ?? "保存设置失败" });
      }
    },

    refreshProviders: async () => {
      const res = await piClient.request("list_providers");
      if (res.success && res.data) {
        set({ providers: (res.data.providers as PiProviderInfo[]) ?? [] });
      } else {
        set({ lastError: res.error ?? "获取 Provider 列表失败" });
      }
    },

    refreshCatalogModels: async () => {
      set({ modelsRefreshing: true });
      try {
        // 先强制从网络刷新模型目录，再读取最新缓存列表
        const refreshRes = await piClient.request("refresh_models");
        if (!refreshRes.success) {
          set({ lastError: refreshRes.error ?? "刷新模型目录失败" });
        } else {
          const errors = ((refreshRes.data as Record<string, unknown>)?.errors ?? {}) as Record<string, string>;
          const entries = Object.entries(errors);
          if (entries.length > 0) {
            set({ lastError: `部分模型目录刷新失败：${entries.map(([k, v]) => `${k}: ${v}`).join("; ")}` });
          }
        }

        const res = await piClient.request("get_models");
        if (res.success && res.data) {
          set({ catalogModels: (res.data.models as PiCatalogModel[]) ?? [] });
          // 模型目录刷新后同步更新 Provider 列表里的模型数量
          await get().refreshProviders();
        } else {
          set({ lastError: res.error ?? "获取模型目录失败" });
        }
      } finally {
        set({ modelsRefreshing: false });
      }
    },

    checkProviderAuth: async (provider) => {
      const res = await piClient.request("get_provider_auth", { provider });
      if (res.success && res.data) {
        set((s) => ({
          providerAuth: { ...s.providerAuth, [provider]: res.data as unknown as PiProviderAuthStatus },
        }));
      }
    },

    setProviderApiKey: async (provider, apiKey) => {
      const res = await piClient.request("set_provider_api_key", { provider, apiKey });
      if (res.success && res.data) {
        set((s) => ({
          providerAuth: { ...s.providerAuth, [provider]: res.data as unknown as PiProviderAuthStatus },
          notice: `已保存 ${provider} API Key，正在重启 Pi 使配置生效…`,
        }));
        // 重启 pi 子进程以加载新凭据
        await get().restartPi();
        await get().refreshProviders();
        return true;
      }
      set({ lastError: res.error ?? "保存 API Key 失败" });
      return false;
    },

    removeProviderApiKey: async (provider) => {
      const res = await piClient.request("remove_provider_api_key", { provider });
      if (res.success && res.data) {
        set((s) => ({
          providerAuth: { ...s.providerAuth, [provider]: res.data as unknown as PiProviderAuthStatus },
          notice: `已移除 ${provider} 凭据，正在重启 Pi…`,
        }));
        await get().restartPi();
        await get().refreshProviders();
      } else {
        set({ lastError: res.error ?? "移除 API Key 失败" });
      }
    },

    sendPrompt: async (text, opts) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      const res = await piClient.request("prompt", {
        message: trimmed,
        ...(opts?.streamingBehavior ? { streamingBehavior: opts.streamingBehavior } : {}),
        ...(opts?.images?.length ? { images: opts.images } : {}),
      });
      if (!res.success) {
        set({ lastError: res.error ?? "发送失败" });
        return false;
      }
      return true;
    },

    steer: (text, images) => {
      piClient.send("steer", { message: text, ...(images?.length ? { images } : {}) });
    },

    followUp: (text, images) => {
      piClient.send("follow_up", { message: text, ...(images?.length ? { images } : {}) });
    },

    abort: () => {
      piClient.send("abort");
    },

    setModel: async (provider, modelId) => {
      const res = await piClient.request("set_model", { provider, modelId });
      if (res.success && res.data) {
        set({ model: res.data as unknown as PiModel });
      } else {
        set({ lastError: res.error ?? "切换模型失败" });
      }
    },

    cycleModel: async () => {
      await piClient.request("cycle_model");
      get().refreshAll();
    },

    setThinkingLevel: async (level) => {
      await piClient.request("set_thinking_level", { level });
      set({ thinkingLevel: level });
    },

    cycleThinkingLevel: async () => {
      const res = await piClient.request("cycle_thinking_level");
      if (res.success && res.data) {
        const level = String((res.data as Record<string, unknown>).level ?? get().thinkingLevel);
        set({ thinkingLevel: level });
      }
    },

    getAvailableThinkingLevels: async () => {
      const res = await piClient.request("get_available_thinking_levels");
      if (res.success && res.data) {
        const levels = (res.data as Record<string, unknown>).levels;
        set({ availableThinkingLevels: Array.isArray(levels) ? (levels as string[]) : [] });
      }
    },

    newSession: async () => {
      await piClient.request("new_session");
      set({ messages: [], activeTools: [], liveMessage: null, extensionUi: null });
      await get().refreshAll();
    },

    switchSession: async (path) => {
      const res = await piClient.request("switch_session", { sessionPath: path });
      if (res.success) {
        set({ messages: [], activeTools: [], liveMessage: null });
        await get().refreshAll();
      } else {
        set({ lastError: res.error ?? "切换会话失败" });
      }
    },

    setSessionName: async (name) => {
      const res = await piClient.request("set_session_name", { name });
      if (res.success) {
        set({ sessionName: name });
        get().refreshSessions();
      }
    },

    setWorkingDir: async (cwd) => {
      const res = await piClient.request("restart", { cwd });
      if (res.success && res.data) {
        set({ cwd: String(res.data.cwd ?? ""), messages: [], activeTools: [], liveMessage: null });
        await get().refreshAll();
      } else {
        set({ lastError: res.error ?? "切换工作目录失败" });
      }
    },

    restartPi: async () => {
      const res = await piClient.request("restart", { cwd: get().cwd || undefined });
      if (res.success) {
        set({ messages: [], activeTools: [], liveMessage: null });
        await get().refreshAll();
      } else {
        set({ lastError: res.error ?? "重启 Pi 失败" });
      }
    },

    compact: async (customInstructions) => {
      const res = await piClient.request("compact", customInstructions ? { customInstructions } : {});
      if (!res.success) set({ lastError: res.error ?? "压缩失败" });
    },

    setAutoCompaction: async (enabled) => {
      await piClient.request("set_auto_compaction", { enabled });
      set({ autoCompactionEnabled: enabled });
    },

    setAutoRetry: async (enabled) => {
      await piClient.request("set_auto_retry", { enabled });
    },

    abortRetry: () => {
      piClient.send("abort_retry");
    },

    fork: async (entryId) => {
      const res = await piClient.request("fork", { entryId });
      if (res.success && res.data) {
        const data = res.data as Record<string, unknown>;
        set({ messages: [], activeTools: [], liveMessage: null });
        await get().refreshAll();
        return { text: String(data.text ?? ""), cancelled: Boolean(data.cancelled) };
      }
      set({ lastError: res.error ?? "fork 失败" });
      return null;
    },

    clone: async () => {
      const res = await piClient.request("clone");
      if (res.success) {
        set({ messages: [], activeTools: [], liveMessage: null });
        await get().refreshAll();
        return !Boolean((res.data as Record<string, unknown>)?.cancelled);
      }
      return false;
    },

    getForkMessages: async () => {
      const res = await piClient.request("get_fork_messages");
      if (res.success && res.data) {
        const list = (res.data as Record<string, unknown>).messages;
        return Array.isArray(list) ? (list as Array<{ entryId: string; text: string }>) : [];
      }
      return [];
    },

    regenerateMessage: async (messageId) => {
      const { messages } = get();
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return false;

      // 定位目标用户消息：user 消息用自身，assistant 用其之前最近的一条 user
      let userIdx = -1;
      if (messages[idx].role === "user") {
        userIdx = idx;
      } else {
        for (let i = idx - 1; i >= 0; i--) {
          if (messages[i].role === "user") {
            userIdx = i;
            break;
          }
        }
      }
      if (userIdx < 0) return false;

      // 该用户消息在所有 user 消息中的序号（与 get_fork_messages 的返回顺序对齐）
      let userOrder = -1;
      for (let i = 0; i <= userIdx; i++) {
        if (messages[i].role === "user") userOrder++;
      }

      const forkMessages = await get().getForkMessages();
      const target = forkMessages[userOrder];
      if (!target) {
        set({ lastError: "找不到可重新生成的消息" });
        return false;
      }

      const res = await piClient.request("fork", { entryId: target.entryId });
      if (res.success && res.data) {
        const text = String((res.data as Record<string, unknown>).text ?? "");
        set({ messages: [], activeTools: [], liveMessage: null });
        await get().refreshAll();
        if (text) await get().sendPrompt(text);
        return true;
      }
      set({ lastError: res.error ?? "重新生成失败" });
      return false;
    },

    rollbackToMessage: async (messageId) => {
      const { messages } = get();
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return false;

      // 定位该消息之前最近的一条 user 消息（回退点）
      let userIdx = -1;
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          userIdx = i;
          break;
        }
      }
      // 若自身就是 user 且无更早 user，则无可回退点
      if (userIdx < 0) {
        set({ lastError: "该消息之前没有可回退的历史" });
        return false;
      }

      let userOrder = -1;
      for (let i = 0; i <= userIdx; i++) {
        if (messages[i].role === "user") userOrder++;
      }

      const forkMessages = await get().getForkMessages();
      const target = forkMessages[userOrder];
      if (!target) {
        set({ lastError: "找不到回退目标" });
        return false;
      }

      // fork 到该用户消息（保留其之前的历史），但不重发
      const res = await piClient.request("fork", { entryId: target.entryId });
      if (res.success && res.data) {
        set({ messages: [], activeTools: [], liveMessage: null });
        await get().refreshAll();
        return true;
      }
      set({ lastError: res.error ?? "回退失败" });
      return false;
    },

    getTree: async () => {
      const res = await piClient.request("get_tree");
      if (res.success && res.data) {
        const data = res.data as Record<string, unknown>;
        return {
          tree: Array.isArray(data.tree) ? (data.tree as SessionTreeNode[]) : [],
          leafId: data.leafId != null ? String(data.leafId) : null,
        };
      }
      return null;
    },

    getEntries: async (since) => {
      const res = await piClient.request("get_entries", since ? { since } : {});
      return res.success ? res.data : null;
    },

    exportHtml: async (outputPath) => {
      const res = await piClient.request("export_html", outputPath ? { outputPath } : {});
      if (res.success && res.data) {
        return String((res.data as Record<string, unknown>).path ?? "");
      }
      set({ lastError: res.error ?? "导出失败" });
      return null;
    },

    setSteeringMode: async (mode) => {
      await piClient.request("set_steering_mode", { mode });
      set({ steeringMode: mode });
    },

    setFollowUpMode: async (mode) => {
      await piClient.request("set_follow_up_mode", { mode });
      set({ followUpMode: mode });
    },

    bash: async (command) => {
      set({ activeBashOutput: "" });
      const res = await piClient.request("bash", { command }, 300000);
      set({ activeBashOutput: null });
      if (res.success && res.data) {
        const data = res.data as Record<string, unknown>;
        return {
          output: String(data.output ?? ""),
          exitCode: Number(data.exitCode ?? 0),
          cancelled: Boolean(data.cancelled),
          truncated: Boolean(data.truncated),
          fullOutputPath: data.fullOutputPath != null ? String(data.fullOutputPath) : null,
        };
      }
      set({ lastError: res.error ?? "bash 执行失败" });
      return null;
    },

    abortBash: () => {
      piClient.send("abort_bash");
    },

    getLastAssistantText: async () => {
      const res = await piClient.request("get_last_assistant_text");
      if (res.success && res.data) {
        const text = (res.data as Record<string, unknown>).text;
        return text == null ? null : String(text);
      }
      return null;
    },

    getContextFile: async () => {
      const res = await piClient.request("get_context_file");
      if (res.success && res.data) {
        const data = res.data as Record<string, unknown>;
        return { path: String(data.path ?? ""), content: String(data.content ?? "") };
      }
      return null;
    },

    setContextFile: async (content) => {
      const res = await piClient.request("set_context_file", { content });
      if (res.success && res.data) {
        return { path: String((res.data as Record<string, unknown>).path ?? "") };
      }
      set({ lastError: res.error ?? "保存项目指令失败" });
      return null;
    },

    listWorkspaceFiles: async () => {
      const res = await piClient.request("list_workspace_files");
      if (res.success && res.data) {
        const files = (res.data as Record<string, unknown>).files;
        return Array.isArray(files) ? (files as string[]) : [];
      }
      return [];
    },

    getProjectTrust: async () => {
      const res = await piClient.request("get_project_trust");
      if (res.success && res.data) {
        const decision = (res.data as Record<string, unknown>).decision;
        return decision === true ? true : decision === false ? false : null;
      }
      return null;
    },

    setProjectTrust: async (decision) => {
      const res = await piClient.request("set_project_trust", { decision });
      if (!res.success) {
        set({ lastError: res.error ?? "设置项目信任失败" });
      }
    },

    respondExtensionUi: (response) => {
      piClient.send("extension_ui_response", response);
      set({ extensionUi: null });
    },

    dismissExtensionUi: () => {
      const req = get().extensionUi;
      if (req && ["select", "confirm", "input", "editor"].includes(req.method)) {
        // 对话框不能简单忽略，发送取消
        piClient.send("extension_ui_response", { id: req.id, cancelled: true });
      }
      set({ extensionUi: null });
    },

    clearNotice: () => set({ notice: null }),

    setNotice: (text) => set({ notice: text }),

    consumeEditorPrefill: () => set({ editorPrefill: null }),

    setSidebarOpen: (open) => set({ isSidebarOpen: open }),
    setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
    setSettingsOpen: (open) => set({ isSettingsOpen: open }),
    setModelDialogOpen: (open) => set({ isModelDialogOpen: open }),
    setTreeDialogOpen: (open) => set({ isTreeDialogOpen: open }),
    setSettingsTheme: (theme) => set({ settingsTheme: theme }),
    setStreamingOutput: (enabled) => set({ streamingOutput: enabled }),
  };
});

export function toolArgsToPrettyString(args: unknown): string {
  return toolArgsToString(args);
}
