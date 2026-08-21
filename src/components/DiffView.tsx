import * as React from "react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────
 * DIFF VIEW — 统一 diff 的行级渲染
 * 解析 edit/write 工具返回的 unified diff，按行着色：
 * 新增（绿）、删除（红）、上下文（灰）、hunk 头（强调）、
 * 文件头（弱化）。适合放在工具结果卡片内。
 * ───────────────────────────────────────────────────────── */

type DiffTone = "add" | "del" | "ctx" | "hunk" | "meta";
interface DiffLine {
  tone: DiffTone;
  text: string;
}

function parseDiff(diff: string): DiffLine[] {
  return diff.split("\n").map((line) => {
    if (line.startsWith("@@")) return { tone: "hunk", text: line };
    if (line.startsWith("---") || line.startsWith("+++")) return { tone: "meta", text: line };
    if (line.startsWith("+")) return { tone: "add", text: line };
    if (line.startsWith("-")) return { tone: "del", text: line };
    return { tone: "ctx", text: line };
  });
}

export function DiffView({ diff }: { diff: string }) {
  const lines = React.useMemo(() => parseDiff(diff), [diff]);
  const add = lines.filter((l) => l.tone === "add").length;
  const del = lines.filter((l) => l.tone === "del").length;

  if (lines.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="flex items-center justify-between border-b border-line bg-inset px-2.5 py-1 font-mono text-[11px] text-ink-2">
        <span>diff</span>
        <span className="tabular-nums">
          <span className="text-green">+{add}</span>
          {del > 0 && <span className="text-red"> −{del}</span>}
        </span>
      </div>
      <div className="scrollbar-thin max-h-72 overflow-auto bg-surface py-1 font-mono text-[11px] leading-[1.7]">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2 px-2.5 whitespace-pre-wrap break-all",
              line.tone === "add" && "bg-green-tint text-green",
              line.tone === "del" && "bg-red-tint text-red",
              line.tone === "hunk" && "bg-accent-tint text-accent-ink",
              line.tone === "meta" && "text-ink-3",
              line.tone === "ctx" && "text-ink-2",
            )}
          >
            <span className="w-3 shrink-0 select-none">
              {line.tone === "add" ? "+" : line.tone === "del" ? "−" : line.tone === "hunk" ? "@@" : " "}
            </span>
            <span className="min-w-0">{line.text.replace(/^[+-]/, "")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
