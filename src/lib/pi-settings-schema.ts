import type { PiSettings } from "@/lib/pi-types";

export type SettingFieldType = "boolean" | "string" | "number" | "select" | "json";

export interface SettingField {
  key: string;
  label: string;
  desc?: string;
  type: SettingFieldType;
  options?: string[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: unknown;
  restartRequired?: boolean;
}

export interface SettingsSection {
  title: string;
  fields: SettingField[];
}

export interface SettingsTab {
  id: string;
  label: string;
  sections: SettingsSection[];
}

export const SETTINGS_TABS: SettingsTab[] = [
  {
    id: "model",
    label: "模型",
    sections: [
      {
        title: "模型与思考",
        fields: [
          { key: "defaultProvider", label: "默认 Provider", desc: "例如 anthropic / openai / deepseek", type: "string", placeholder: "anthropic" },
          { key: "defaultModel", label: "默认模型 ID", desc: "例如 claude-sonnet-4-20250514", type: "string", placeholder: "claude-sonnet-4-20250514" },
          { key: "defaultThinkingLevel", label: "默认思考等级", type: "select", options: ["off", "minimal", "low", "medium", "high", "xhigh", "max"], defaultValue: "off" },
          { key: "hideThinkingBlock", label: "隐藏思考块", desc: "在输出中隐藏 thinking block", type: "boolean", defaultValue: false },
          { key: "showCacheMissNotices", label: "缓存未命中提示", desc: "当 prompt 缓存显著未命中时显示提示", type: "boolean", defaultValue: false },
          { key: "thinkingBudgets", label: "思考预算（JSON）", desc: "按等级自定义 token 预算，如 {\"minimal\":1024,\"low\":4096,\"medium\":10240,\"high\":32768}", type: "json", defaultValue: {} },
          { key: "enabledModels", label: "启用模型（JSON 数组）", desc: "Ctrl+P 循环的模型 patterns，如 [\"claude-*\",\"gpt-4o\"]", type: "json", defaultValue: [] },
        ],
      },
    ],
  },
  {
    id: "ui",
    label: "界面",
    sections: [
      {
        title: "界面与显示",
        fields: [
          { key: "theme", label: "TUI 主题", type: "string", placeholder: "dark", defaultValue: "dark" },
          { key: "externalEditor", label: "外部编辑器", desc: "Ctrl+G 调用，如 code --wait", type: "string", placeholder: "code --wait" },
          { key: "quietStartup", label: "静默启动", desc: "隐藏启动头部信息", type: "boolean", defaultValue: false },
          { key: "defaultProjectTrust", label: "项目信任策略", desc: "非交互模式默认项目信任（全局设置）", type: "select", options: ["ask", "always", "never"], defaultValue: "ask" },
          { key: "collapseChangelog", label: "折叠更新日志", type: "boolean", defaultValue: false },
          { key: "enableInstallTelemetry", label: "安装遥测", desc: "发送匿名安装/更新版本 ping", type: "boolean", defaultValue: true },
          { key: "enableAnalytics", label: "启用分析", desc: "仅实验性首次设置询问", type: "boolean", defaultValue: false },
          { key: "trackingId", label: "跟踪 ID", desc: "开启分析后自动生成，一般无需手动修改", type: "string", placeholder: "自动生成" },
          { key: "doubleEscapeAction", label: "双击 Escape 行为", type: "select", options: ["tree", "fork", "none"], defaultValue: "tree" },
          { key: "treeFilterMode", label: "会话树默认过滤", type: "select", options: ["default", "no-tools", "user-only", "labeled-only", "all"], defaultValue: "default" },
          { key: "editorPaddingX", label: "编辑器水平内边距", desc: "0-3", type: "number", min: 0, max: 3, step: 1, defaultValue: 0 },
          { key: "outputPad", label: "输出水平内边距", desc: "0 或 1", type: "number", min: 0, max: 1, step: 1, defaultValue: 1 },
          { key: "autocompleteMaxVisible", label: "自动补全可见数", desc: "3-20", type: "number", min: 3, max: 20, step: 1, defaultValue: 5 },
          { key: "showHardwareCursor", label: "显示硬件光标", desc: "TUI 定位光标以支持 IME", type: "boolean", defaultValue: false },
          { key: "tuiMode", label: "TUI 模式", type: "select", options: ["regular", "fullscreen"], defaultValue: "regular" },
          { key: "fullscreenExitOutput", label: "全屏退出输出", type: "select", options: ["transcript", "resume-hint"], defaultValue: "transcript" },
          { key: "fullscreenScrollbar", label: "全屏滚动条", type: "select", options: ["auto", "always", "hidden"], defaultValue: "auto" },
        ],
      },
    ],
  },
  {
    id: "network",
    label: "网络",
    sections: [
      {
        title: "网络",
        fields: [
          { key: "httpProxy", label: "HTTP 代理", desc: "同时设置 HTTP_PROXY / HTTPS_PROXY（全局）", type: "string", placeholder: "http://127.0.0.1:7890" },
        ],
      },
      {
        title: "警告",
        fields: [
          { key: "warnings.anthropicExtraUsage", label: "Anthropic 额外用量警告", desc: "订阅认证可能产生付费额外用量时提示", type: "boolean", defaultValue: true },
        ],
      },
    ],
  },
  {
    id: "compaction",
    label: "压缩重试",
    sections: [
      {
        title: "自动压缩",
        fields: [
          { key: "compaction.enabled", label: "启用自动压缩", type: "boolean", defaultValue: true },
          { key: "compaction.reserveTokens", label: "保留 Token", desc: "为 LLM 响应预留", type: "number", min: 0, step: 256, defaultValue: 16384 },
          { key: "compaction.keepRecentTokens", label: "保留最近 Token", desc: "不压缩的最近上下文", type: "number", min: 0, step: 256, defaultValue: 20000 },
        ],
      },
      {
        title: "分支摘要",
        fields: [
          { key: "branchSummary.reserveTokens", label: "摘要保留 Token", type: "number", min: 0, step: 256, defaultValue: 16384 },
          { key: "branchSummary.skipPrompt", label: "跳过摘要询问", desc: "/tree 跳转时默认不摘要", type: "boolean", defaultValue: false },
        ],
      },
      {
        title: "自动重试",
        fields: [
          { key: "retry.enabled", label: "启用自动重试", desc: "瞬时错误自动重试", type: "boolean", defaultValue: true },
          { key: "retry.maxRetries", label: "最大重试次数", type: "number", min: 0, step: 1, defaultValue: 3 },
          { key: "retry.baseDelayMs", label: "基础延迟（ms）", desc: "指数退避基础延迟", type: "number", min: 0, step: 100, defaultValue: 2000 },
          { key: "retry.provider.timeoutMs", label: "Provider 超时（ms）", desc: "SDK 默认，可留空", type: "number", min: 0, step: 1000, defaultValue: undefined },
          { key: "retry.provider.maxRetries", label: "Provider 重试次数", desc: "建议保持 0", type: "number", min: 0, step: 1, defaultValue: 0 },
          { key: "retry.provider.maxRetryDelayMs", label: "Provider 最大重试延迟（ms）", desc: "超过则立即失败，0 禁用限制", type: "number", min: 0, step: 1000, defaultValue: 60000 },
        ],
      },
    ],
  },
  {
    id: "delivery",
    label: "消息传输",
    sections: [
      {
        title: "消息投递",
        fields: [
          { key: "steeringMode", label: "Steering 模式", desc: "运行中 steering 消息投递方式", type: "select", options: ["all", "one-at-a-time"], defaultValue: "one-at-a-time" },
          { key: "followUpMode", label: "Follow-up 模式", desc: "完成后 follow_up 消息投递方式", type: "select", options: ["all", "one-at-a-time"], defaultValue: "one-at-a-time" },
          { key: "transport", label: "传输偏好", desc: "多传输 Provider 的首选传输", type: "select", options: ["sse", "websocket", "websocket-cached", "auto"], defaultValue: "auto" },
          { key: "httpIdleTimeoutMs", label: "HTTP 空闲超时（ms）", desc: "0 禁用", type: "number", min: 0, step: 1000, defaultValue: 300000 },
          { key: "websocketConnectTimeoutMs", label: "WebSocket 连接超时（ms）", desc: "0 禁用", type: "number", min: 0, step: 1000, defaultValue: 15000 },
        ],
      },
    ],
  },
  {
    id: "terminal",
    label: "终端图片",
    sections: [
      {
        title: "终端与图片",
        fields: [
          { key: "terminal.showImages", label: "终端显示图片", type: "boolean", defaultValue: true },
          { key: "terminal.imageWidthCells", label: "图片宽度（格）", type: "number", min: 1, step: 1, defaultValue: 60 },
          { key: "terminal.clearOnShrink", label: "收缩时清空行", desc: "内容收缩时清空空白行（可能闪烁）", type: "boolean", defaultValue: false },
          { key: "images.autoResize", label: "自动缩放图片", desc: "最大 2000x2000", type: "boolean", defaultValue: true },
          { key: "images.blockImages", label: "屏蔽图片", desc: "不向 LLM 发送任何图片", type: "boolean", defaultValue: false },
        ],
      },
    ],
  },
  {
    id: "shell",
    label: "Shell",
    sections: [
      {
        title: "Shell 与工具",
        fields: [
          { key: "shellPath", label: "Shell 路径", desc: "如 C:/Program Files/Git/bin/bash.exe", type: "string", placeholder: "C:/Program Files/Git/bin/bash.exe" },
          { key: "shellCommandPrefix", label: "Shell 命令前缀", desc: "每条 bash 命令前附加", type: "string", placeholder: "shopt -s expand_aliases" },
          { key: "npmCommand", label: "npm 命令（JSON 数组）", desc: "如 [\"mise\",\"exec\",\"node@20\",\"--\",\"npm\"]", type: "json", defaultValue: [] },
          { key: "defaultTools", label: "默认工具（JSON 数组）", desc: "如 [\"bash\",\"edit\",\"write\"]，空数组=无内置工具", type: "json", defaultValue: [] },
        ],
      },
    ],
  },
  {
    id: "session",
    label: "会话",
    sections: [
      {
        title: "会话与 Markdown",
        fields: [
          { key: "sessionDir", label: "会话目录", desc: "支持绝对/相对路径与 ~", type: "string", placeholder: ".pi/sessions" },
          { key: "markdown.codeBlockIndent", label: "代码块缩进", type: "string", defaultValue: "  " },
          { key: "markdown.mermaid", label: "Mermaid 渲染", type: "select", options: ["off", "final", "streaming"], defaultValue: "streaming" },
        ],
      },
    ],
  },
  {
    id: "resources",
    label: "资源",
    sections: [
      {
        title: "资源加载",
        fields: [
          { key: "packages", label: "Packages（JSON）", desc: "npm/git 包，字符串或对象数组", type: "json", defaultValue: [] },
          { key: "extensions", label: "扩展路径（JSON 数组）", desc: "本地扩展文件/目录，支持 glob 与排除", type: "json", defaultValue: [] },
          { key: "skills", label: "Skills 路径（JSON 数组）", desc: "本地 skill 文件/目录", type: "json", defaultValue: [] },
          { key: "prompts", label: "Prompts 路径（JSON 数组）", desc: "本地 prompt 模板路径", type: "json", defaultValue: [] },
          { key: "themes", label: "Themes 路径（JSON 数组）", desc: "本地主题路径", type: "json", defaultValue: [] },
          { key: "enableSkillCommands", label: "启用 /skill:name 命令", type: "boolean", defaultValue: true },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 取深层值 / 构造深层 patch
// ---------------------------------------------------------------------------

export function getSettingValue(settings: PiSettings | null, key: string, defaultValue: unknown): unknown {
  if (!settings) return defaultValue;
  const parts = key.split(".");
  let cur: unknown = settings;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return defaultValue;
    }
  }
  return cur === undefined ? defaultValue : cur;
}

export function makeSettingsPatch(key: string, value: unknown): Record<string, unknown> {
  const parts = key.split(".");
  const patch: Record<string, unknown> = {};
  let cur = patch;
  parts.forEach((p, i) => {
    if (i === parts.length - 1) {
      cur[p] = value;
    } else {
      cur[p] = {};
      cur = cur[p] as Record<string, unknown>;
    }
  });
  return patch;
}
