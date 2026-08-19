import * as React from "react";
import {
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Plus,
  Square,
  ArrowUp,
  ListChecks,
} from "lucide-react";
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

export function Composer() {
  const [value, setValue] = React.useState("");
  const [showCommands, setShowCommands] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const models = useChatStore((s) => s.models);
  const model = useChatStore((s) => s.model);
  const commands = useChatStore((s) => s.commands);
  const queue = useChatStore((s) => s.queue);
  const sendPrompt = useChatStore((s) => s.sendPrompt);
  const steer = useChatStore((s) => s.steer);
  const followUp = useChatStore((s) => s.followUp);
  const abort = useChatStore((s) => s.abort);
  const setModel = useChatStore((s) => s.setModel);
  const editorPrefill = useChatStore((s) => s.editorPrefill);
  const consumeEditorPrefill = useChatStore((s) => s.consumeEditorPrefill);

  // 扩展 set_editor_text 预填输入框
  React.useEffect(() => {
    if (editorPrefill != null) {
      setValue(editorPrefill);
      consumeEditorPrefill();
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [editorPrefill, consumeEditorPrefill]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const doSend = async () => {
    const text = value.trim();
    if (!text) return;
    if (isStreaming) {
      await steer(text);
    } else {
      await sendPrompt(text);
    }
    setValue("");
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      doSend();
    }
    if (e.key === "Escape" && showCommands) {
      setShowCommands(false);
    }
  };

  React.useEffect(() => {
    autoResize();
  }, [value]);

  // 斜杠命令补全
  React.useEffect(() => {
    if (value.startsWith("/")) {
      const q = value.slice(1).trim().toLowerCase();
      if (q.length <= 12) {
        setShowCommands(true);
      }
    } else {
      setShowCommands(false);
    }
  }, [value]);

  const matchingCommands = commands
    .filter((c) => {
      const q = value.slice(1).trim().toLowerCase();
      return !q || c.name.toLowerCase().includes(q);
    })
    .slice(0, 8);

  const pendingCount = queue.steering.length + queue.followUp.length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-2">
      {showCommands && matchingCommands.length > 0 && (
        <div className="mb-2 rounded-xl border bg-popover p-1 shadow-lg">
          <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Pi 命令
          </div>
          {matchingCommands.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => {
                setValue(`/${c.name} `);
                setShowCommands(false);
                textareaRef.current?.focus();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
            >
              <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">/{c.name}</span>
              {c.description && (
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {c.description}
                </span>
              )}
              <span className="shrink-0 text-[10px] uppercase text-ink-3">{c.source ?? ""}</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative rounded-window bg-surface shadow-card transition-shadow focus-within:shadow-raised">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={isStreaming ? "向运行中的 Pi 发送 steering 消息…" : "给 Pi 发送消息，或输入 / 使用命令…"}
          className="block max-h-[200px] w-full resize-none bg-transparent px-4 pt-4 pb-12 text-[15px] leading-7 text-ink outline-none placeholder:text-ink-3"
        />
        <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="text-ink-3 hover:text-ink" aria-label="添加附件">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" sideOffset={8}>
                <DropdownMenuLabel>添加附件</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <ImageIcon />
                  上传图片
                  <span className="ml-auto text-xs text-muted-foreground">待接入</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <FileText />
                  上传文件
                  <span className="ml-auto text-xs text-muted-foreground">待接入</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-8 gap-1.5 rounded-chip text-xs font-medium text-ink-2 hover:text-ink">
                  {model?.name ?? "选择模型"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-72">
                <DropdownMenuLabel>选择模型（{models.length}）</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="scrollbar-thin max-h-72 overflow-y-auto">
                  {models.map((m) => (
                    <DropdownMenuItem
                      key={`${m.provider}/${m.id}`}
                      onClick={() => setModel(m.provider, m.id)}
                      className="flex flex-col items-start gap-0.5"
                    >
                      <span className="flex w-full items-center justify-between">
                        <span className="font-medium">{m.name}</span>
                        {model?.id === m.id && model?.provider === m.provider && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {m.provider}/{m.id} · {m.contextWindow ? `${m.contextWindow.toLocaleString()} ctx` : ""}
                        {m.reasoning ? " · reasoning" : ""}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                队列 {pendingCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {isStreaming ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-ink-2" onClick={() => followUp(value.trim() || "继续")}>
                      后续消息
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>排队为 follow_up，在 Pi 完成后发送</TooltipContent>
                </Tooltip>
                <Button size="icon" variant="secondary" aria-label="停止生成" onClick={abort}>
                  <Square className="h-3.5 w-3.5 fill-current" />
                </Button>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    aria-label="发送"
                    disabled={!value.trim()}
                    onClick={doSend}
                    className="h-8 w-8 rounded-control bg-ink text-page shadow-btn hover:opacity-90"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>发送（Enter）· 换行（Shift+Enter）</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] leading-4 text-ink-3">
        Pi Agent 驱动 · 支持 /skill:name、/prompt 模板与扩展命令 · Enter 发送，Shift+Enter 换行
      </p>
    </div>
  );
}
