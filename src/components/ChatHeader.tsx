import * as React from "react";
import { Boxes, Check, Copy, Download, Loader2, Menu, Monitor, Moon, Search, Settings, Sun } from "lucide-react";
import { useChatStore } from "@/store/chat";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function messagesToMarkdown(
  messages: ReturnType<typeof useChatStore.getState>["messages"]
): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      lines.push(`## 用户\n\n${m.text}`);
    } else if (m.role === "assistant") {
      lines.push(`## Assistant\n\n${m.text}`);
    } else if (m.role === "toolResult") {
      lines.push(`### 工具结果：${m.toolName ?? "unknown"}${m.isError ? "（失败）" : ""}\n\n\`\`\`\n${m.resultText || m.text || "(空)"}\n\`\`\``);
    } else if (m.role === "bashExecution") {
      lines.push(`### 命令\n\n\`\`\`bash\n${m.command ?? ""}\n\`\`\`\n\n\`\`\`\n${m.text || "(无输出)"}\n\`\`\``);
    }
  }
  return lines.join("\n\n");
}

export function ChatHeader() {
  const model = useChatStore((s) => s.model);
  const thinkingLevel = useChatStore((s) => s.thinkingLevel);
  const sessionName = useChatStore((s) => s.sessionName);
  const status = useChatStore((s) => s.status);
  const stats = useChatStore((s) => s.stats);
  const messages = useChatStore((s) => s.messages);
  const setNotice = useChatStore((s) => s.setNotice);
  const isCompacting = useChatStore((s) => s.isCompacting);
  const retryInfo = useChatStore((s) => s.retryInfo);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const setCommandPaletteOpen = useChatStore((s) => s.setCommandPaletteOpen);
  const setSettingsOpen = useChatStore((s) => s.setSettingsOpen);
  const setModelDialogOpen = useChatStore((s) => s.setModelDialogOpen);
  const settingsTheme = useChatStore((s) => s.settingsTheme);
  const setSettingsTheme = useChatStore((s) => s.setSettingsTheme);
  const [copied, setCopied] = React.useState(false);

  const statusText =
    status === "connected" ? "已连接" : status === "connecting" ? "连接中" : "未连接";

  const contextPercent = stats?.contextUsage?.percent;
  const cost = stats?.cost;

  const onCopyConversation = async () => {
    const md = messagesToMarkdown(messages);
    if (!md.trim()) return;
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setNotice("复制失败：当前环境不支持剪贴板");
    }
  };

  const onDownloadMarkdown = () => {
    const md = messagesToMarkdown(messages);
    if (!md.trim()) return;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessionName || "会话"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-dashed border-line bg-page px-3 backdrop-blur-md sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="打开侧栏"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="truncate text-sm font-medium text-foreground">{sessionName ?? "Pi 会话"}</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-chip bg-field px-2 py-0.5 text-[11px] shadow-btn ${
            status === "connected" ? "text-green" : "text-ink-2"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "connected" ? "bg-emerald-500" : status === "connecting" ? "bg-amber-500" : "bg-red-500"
            }`}
          />
          {statusText}
        </span>
        {isCompacting && (
          <span
            className="hidden items-center gap-1.5 rounded-chip bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 shadow-btn sm:inline-flex dark:text-amber-400"
            title="正在压缩上下文以降低 token 用量"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            压缩中
          </span>
        )}
        {retryInfo && (
          <span
            className="hidden items-center gap-1.5 rounded-chip bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 shadow-btn sm:inline-flex dark:text-amber-400"
            title="瞬时错误自动重试中"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            重试 {retryInfo.attempt}/{retryInfo.maxAttempts}
          </span>
        )}
        {model && (
          <span className="hidden rounded-chip bg-field px-2 py-0.5 text-[11px] text-ink-2 shadow-btn sm:inline-block">
            {model.name} · {thinkingLevel}
          </span>
        )}
        {contextPercent != null && (
          <span
            className="hidden rounded-chip bg-field px-2 py-0.5 text-[11px] tabular-nums shadow-btn sm:inline-block"
            title={`上下文占用 ${contextPercent}%（${stats?.contextUsage?.tokens ?? "—"} / ${stats?.contextUsage?.contextWindow ?? "—"} tokens）`}
          >
            <span className={contextPercent >= 80 ? "text-orange" : "text-ink-2"}>上下文 {contextPercent}%</span>
          </span>
        )}
        {cost != null && (
          <span className="hidden rounded-chip bg-field px-2 py-0.5 text-[11px] tabular-nums text-ink-2 shadow-btn sm:inline-block">
            ${Number(cost).toFixed(4)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="搜索与命令"
            >
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>搜索与命令（Ctrl+K）</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="切换主题">
              {settingsTheme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : settingsTheme === "light" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>外观</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSettingsTheme("light")}>
              <Sun />
              浅色
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSettingsTheme("dark")}>
              <Moon />
              深色
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSettingsTheme("system")}>
              <Monitor />
              跟随系统
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCopyConversation}
              disabled={messages.length === 0}
              aria-label="复制整段对话"
            >
              {copied ? <Check className="h-4 w-4 text-green" /> : <Copy className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? "已复制" : "复制整段对话"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDownloadMarkdown}
              disabled={messages.length === 0}
              aria-label="导出为 Markdown"
            >
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>导出为 Markdown</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setModelDialogOpen(true)}
              aria-label="模型与接入商"
            >
              <Boxes className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>模型与接入商</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label="设置">
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>设置</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
