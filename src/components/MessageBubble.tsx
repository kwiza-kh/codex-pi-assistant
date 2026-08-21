import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  RefreshCw,
  RotateCcw,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useChatStore, toolArgsToPrettyString } from "@/store/chat";
import type { ToolActivity, UIMessage } from "@/lib/pi-types";
import { Markdown } from "@/components/Markdown";
import { StreamingText } from "@/components/StreamingText";
import { ThinkingState, type ThinkingRow } from "@/components/ThinkingState";
import { DiffView } from "@/components/DiffView";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="inline-flex h-7 items-center gap-1 rounded-control px-1.5 text-xs text-ink-3 transition-colors hover:bg-hover hover:text-ink"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CollapsibleCard({
  title,
  children,
  defaultOpen = false,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  tone?: "default" | "error" | "danger";
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div
      className={cn(
        "my-2 overflow-hidden rounded-window text-sm shadow-hairline",
        tone === "error" ? "bg-red-tint" : tone === "danger" ? "bg-orange-tint" : "bg-inset"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-ink-2 transition-colors hover:bg-hover"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{title}</span>
      </button>
      {open && <div className="border-t border-dashed border-line px-3 py-2">{children}</div>}
    </div>
  );
}

function ToolCallBlock({ block }: { block: { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> | string } }) {
  const pretty = typeof block.arguments === "string" ? block.arguments : toolArgsToPrettyString(block.arguments);
  return (
    <CollapsibleCard title={`调用工具：${block.name}`} tone="default">
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-muted-foreground">
        {pretty}
      </pre>
    </CollapsibleCard>
  );
}

function ThinkingTrace({ thinking, streaming }: { thinking: string; streaming: boolean }) {
  const rows: ThinkingRow[] = thinking.trim() ? [{ primary: thinking.trim() }] : [];
  return <ThinkingState variant="Reasoning" active={streaming} rows={rows} />;
}

function ToolResultCard({ message }: { message: UIMessage }) {
  const tone = message.isError ? "error" : "default";
  return (
    <CollapsibleCard
      title={`工具结果：${message.toolName ?? "unknown"}${message.isError ? "（失败）" : ""}`}
      tone={tone}
      defaultOpen={Boolean(message.isError)}
    >
      {message.diff ? (
        <DiffView diff={message.diff} />
      ) : (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-muted-foreground">
          {message.resultText || message.text || "(空)"}
        </pre>
      )}
    </CollapsibleCard>
  );
}

function BashExecutionCard({ message }: { message: UIMessage }) {
  return (
    <CollapsibleCard
      title={`$ ${message.command ?? ""}`}
      defaultOpen
    >
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-muted-foreground">
        {message.text || "(无输出)"}
      </pre>
      {typeof message.exitCode === "number" && (
        <div className="mt-1 text-[11px] text-muted-foreground">退出码：{message.exitCode}</div>
      )}
    </CollapsibleCard>
  );
}

interface MessageBubbleProps {
  message: UIMessage;
  isLast: boolean;
  showTimestamp?: boolean;
}

export function MessageBubble({ message, isLast, showTimestamp = true }: MessageBubbleProps) {
  const [copied, setCopied] = React.useState(false);
  const [liked, setLiked] = React.useState<"up" | "down" | null>(null);
  const [regenerating, setRegenerating] = React.useState(false);
  const [rollingBack, setRollingBack] = React.useState(false);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingOutput = useChatStore((s) => s.streamingOutput);
  const regenerateMessage = useChatStore((s) => s.regenerateMessage);
  const rollbackToMessage = useChatStore((s) => s.rollbackToMessage);
  const isUser = message.role === "user";
  const isToolResult = message.role === "toolResult";
  const isBashExecution = message.role === "bashExecution";

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const onRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      await regenerateMessage(message.id);
    } finally {
      setRegenerating(false);
    }
  };

  const onRollback = async () => {
    if (rollingBack) return;
    setRollingBack(true);
    try {
      await rollbackToMessage(message.id);
    } finally {
      setRollingBack(false);
    }
  };

  if (isUser) {
    return (
      <div className="group flex justify-end gap-3 animate-fade-in">
        <div className="flex max-w-[85%] flex-col items-end gap-1">
          <div className="whitespace-pre-wrap break-words rounded-window rounded-br-control bg-field px-4 py-2.5 text-[15px] leading-7 text-ink shadow-btn [overflow-wrap:anywhere]">
            {message.text}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <ActionButton label="重新生成" onClick={onRegenerate}>
              <RefreshCw className={cn("h-3.5 w-3.5", regenerating && "animate-spin")} />
            </ActionButton>
            <ActionButton label="回退到此之前" onClick={onRollback}>
              <RotateCcw className={cn("h-3.5 w-3.5", rollingBack && "animate-spin")} />
            </ActionButton>
            <ActionButton label="复制" onClick={onCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </ActionButton>
          </div>
          {showTimestamp && message.timestamp && (
            <span className="pr-1 text-[11px] text-muted-foreground">
              {formatRelativeTime(message.timestamp)}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (isToolResult) {
    return (
      <div className="animate-fade-in">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold">工具</span>
            <span>{message.toolName}</span>
          </div>
          <ToolResultCard message={message} />
        </div>
      </div>
    );
  }

  if (isBashExecution) {
    return (
      <div className="animate-fade-in">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-xs font-semibold text-muted-foreground">直接 bash</div>
          <BashExecutionCard message={message} />
        </div>
      </div>
    );
  }

  // assistant
  const textIndexes = message.blocks.map((b, i) => (b.type === "text" ? i : -1)).filter((i) => i >= 0);
  const lastTextIndex = textIndexes.length ? textIndexes[textIndexes.length - 1] : -1;
  return (
    <div className="group flex gap-3 animate-fade-in">
      <div className="min-w-0 flex-1">
        {message.blocks.length === 0 && message.text ? (
          <Markdown content={message.text} />
        ) : (
          <div className="space-y-1">
            {message.blocks.map((block, i) => {
              if (block.type === "text") {
                if (!block.text) return null;
                if (isLast && isStreaming && streamingOutput && i === lastTextIndex) {
                  return <StreamingText key={i} content={block.text} streaming />;
                }
                return <Markdown key={i} content={block.text} />;
              }
              if (block.type === "thinking") {
                return <ThinkingTrace key={i} thinking={block.thinking} streaming={isLast && isStreaming} />;
              }
              if (block.type === "toolCall") {
                return <ToolCallBlock key={i} block={block} />;
              }
              return null;
            })}
          </div>
        )}

        {isLast && message.text === "" && message.blocks.length === 0 && (
          <span className="text-sm text-muted-foreground">思考中…</span>
        )}

        {message.text && (
          <div className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <ActionButton label="复制" onClick={onCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </ActionButton>
            <ActionButton label="重新生成" onClick={onRegenerate}>
              <RefreshCw className={cn("h-3.5 w-3.5", regenerating && "animate-spin")} />
            </ActionButton>
            <ActionButton label="回退到此之前" onClick={onRollback}>
              <RotateCcw className={cn("h-3.5 w-3.5", rollingBack && "animate-spin")} />
            </ActionButton>
            <ActionButton label={liked === "up" ? "已赞" : "有帮助"} onClick={() => setLiked(liked === "up" ? null : "up")}>
              <ThumbsUp className={cn("h-3.5 w-3.5", liked === "up" && "fill-current text-emerald-500")} />
            </ActionButton>
            <ActionButton label={liked === "down" ? "已踩" : "没帮助"} onClick={() => setLiked(liked === "down" ? null : "down")}>
              <ThumbsDown className={cn("h-3.5 w-3.5", liked === "down" && "fill-current text-destructive")} />
            </ActionButton>
          </div>
        )}

        {showTimestamp && message.timestamp && (
          <div className="mt-1.5 text-[11px] text-ink-3">{formatRelativeTime(message.timestamp)}</div>
        )}
      </div>
    </div>
  );
}

/** 流式生成中的活跃工具轨迹（放在 live message 下方，Coding 变体） */
const TOOL_LABELS: Record<string, string> = {
  read: "Read",
  write: "Write",
  edit: "Edit",
  bash: "Run",
  grep: "Search",
  glob: "Find",
  list: "List",
  fetch: "Fetch",
};

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

function toolSecondary(name: string, args: Record<string, unknown>): string | undefined {
  const a = args ?? {};
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = a[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return undefined;
  };
  if (["read", "write", "edit", "list"].includes(name)) {
    return pick("path", "file_path", "filePath", "file");
  }
  if (name === "bash") return pick("command", "cmd", "code");
  if (name === "grep") {
    const pattern = pick("pattern", "regex", "query");
    const path = pick("path", "dir", "file");
    return [pattern, path].filter(Boolean).join(" · ");
  }
  if (name === "glob") return pick("pattern", "path");
  if (name === "fetch") return pick("url", "uri");
  for (const v of Object.values(a)) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function toolRowFromActivity(t: ToolActivity): ThinkingRow {
  return {
    id: t.toolCallId,
    primary: toolLabel(t.toolName),
    secondary: toolSecondary(t.toolName, t.args),
    mono: true,
    output: t.output || undefined,
  };
}

export function ActiveToolsCard() {
  const activeTools = useChatStore((s) => s.activeTools);
  const abort = useChatStore((s) => s.abort);
  const active = activeTools.some((t) => t.status === "running");

  if (activeTools.length === 0) return null;
  return (
    <div className="mt-2">
      {active && (
        <button
          type="button"
          onClick={abort}
          className="mb-1.5 flex items-center gap-1.5 rounded-[7px] bg-inset px-2 py-1 text-[11.5px] font-medium text-ink-2 transition-colors hover:bg-hover"
        >
          <Square size={12} className="fill-current" />
          中止当前运行
        </button>
      )}
      <ThinkingState
        variant="Coding"
        active={active}
        rows={activeTools.map(toolRowFromActivity)}
        defaultExpanded
        activeLabel="运行工具中"
        doneLabel="工具运行完成"
      />
    </div>
  );
}
