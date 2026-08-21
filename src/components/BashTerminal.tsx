import * as React from "react";
import { ChevronDown, TerminalSquare, XCircle } from "lucide-react";
import { useChatStore } from "@/store/chat";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────
 * BASH TERMINAL — 直接 bash 终端面板
 * 手动执行 shell 命令并实时查看输出（bash_execution_update）。
 * 命令结果会加入会话上下文，供下一次 prompt 使用。
 * ───────────────────────────────────────────────────────── */

interface BashHistoryItem {
  command: string;
  output: string;
  exitCode: number;
  truncated: boolean;
  fullOutputPath: string | null;
}

export function BashTerminal() {
  const [open, setOpen] = React.useState(false);
  const [command, setCommand] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [history, setHistory] = React.useState<BashHistoryItem[]>([]);
  const activeBashOutput = useChatStore((s) => s.activeBashOutput);
  const bash = useChatStore((s) => s.bash);
  const abortBash = useChatStore((s) => s.abortBash);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [activeBashOutput, history.length, open]);

  const run = async () => {
    const cmd = command.trim();
    if (!cmd || running) return;
    setCommand("");
    setRunning(true);
    const res = await bash(cmd);
    setRunning(false);
    if (res) {
      setHistory((h) => [
        ...h,
        { command: cmd, output: res.output, exitCode: res.exitCode, truncated: res.truncated, fullOutputPath: res.fullOutputPath },
      ]);
    }
    inputRef.current?.focus();
  };

  return (
    <div className={cn("flex flex-col border-t border-dashed border-line", open && "min-h-0 flex-1")}>
      {/* 折叠头 */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full shrink-0 items-center gap-2 px-4 py-1.5 text-left text-[11px] font-medium text-ink-3 transition-colors hover:bg-hover hover:text-ink-2"
      >
        <TerminalSquare className="h-3.5 w-3.5" />
        <span>终端</span>
        {running && <span className="animate-pulse text-amber-500">运行中…</span>}
        <ChevronDown
          className={cn("ml-auto h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-line bg-inset">
          {/* 输出区 */}
          <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-5 text-ink-2">
            {history.length === 0 && !activeBashOutput && (
              <div className="text-ink-3">输入 shell 命令并回车，输出会实时显示在这里。</div>
            )}
            {history.map((item, i) => (
              <div key={i} className="mb-2">
                <div className="flex items-center gap-2 text-ink">
                  <span className="select-none text-ink-3">$</span>
                  <span>{item.command}</span>
                  <span className={cn("text-[10px]", item.exitCode === 0 ? "text-green" : "text-red")}>
                    [{item.exitCode}]
                  </span>
                </div>
                {item.output && <div className="mt-0.5 whitespace-pre-wrap text-ink-2">{item.output}</div>}
                {item.truncated && item.fullOutputPath && (
                  <div className="mt-0.5 text-ink-3">输出已截断，完整内容：{item.fullOutputPath}</div>
                )}
              </div>
            ))}
            {activeBashOutput != null && (
              <div>
                <div className="flex items-center gap-2 text-ink">
                  <span className="select-none text-ink-3">$</span>
                  <span>…</span>
                  <span className="animate-pulse text-[10px] text-amber-500">运行中</span>
                </div>
                <div className="mt-0.5 whitespace-pre-wrap text-ink-2">{activeBashOutput}</div>
              </div>
            )}
          </div>

          {/* 命令输入 */}
          <div className="flex shrink-0 items-center gap-2 border-t border-line px-4 py-2">
            <span className="select-none font-mono text-[11px] text-ink-3">$</span>
            <input
              ref={inputRef}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void run();
                }
              }}
              placeholder="输入命令…"
              aria-label="终端命令"
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-ink outline-none placeholder:text-ink-3"
            />
            {running ? (
              <button
                type="button"
                aria-label="中止命令"
                onClick={abortBash}
                className="flex size-6 items-center justify-center rounded-[6px] text-red transition-colors hover:bg-red-tint"
              >
                <XCircle className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="执行命令"
                disabled={!command.trim()}
                onClick={() => void run()}
                className="flex h-6 items-center rounded-[6px] px-2 text-[11px] font-medium text-ink-2 transition-colors enabled:hover:bg-hover enabled:hover:text-ink disabled:opacity-40"
              >
                执行
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
