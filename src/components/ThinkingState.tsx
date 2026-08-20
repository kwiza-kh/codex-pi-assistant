import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { StreamingText } from "@/components/StreamingText";

/* ─────────────────────────────────────────────────────────
 * THINKING — 可展开的 agent 轨迹，四种变体
 *
 *   Steps      步骤列表：spinner → 淡入的对勾
 *   Reasoning  展开后稳定下来的推理文本
 *   Search     网页搜索轨迹：查询词 + 已读来源
 *   Coding     工具轨迹：已读文件、编辑、命令
 *
 * 轨迹由调用方传入的 rows 数据驱动，进行中（active）
 * 与完成（settle）状态也由 props 控制；轨迹结束后仍可展开。
 * ───────────────────────────────────────────────────────── */

export type ThinkingVariant = "Steps" | "Reasoning" | "Search" | "Coding";

export type ThinkingRow = {
  primary: string;
  secondary?: string;
  mono?: boolean;
  add?: number;
  del?: number;
  href?: string;
  /** Coding 变体：选中该工具行后展示的实时输出 */
  output?: string;
};

const DEFAULT_LABELS: Record<ThinkingVariant, { active: string; done: string }> = {
  Steps: { active: "思考中", done: "思考完成" },
  Reasoning: { active: "思考中", done: "思考过程" },
  Search: { active: "搜索网页", done: "搜索完成" },
  Coding: { active: "运行工具", done: "工具运行完成" },
};

const TONES = ["bg-accent", "bg-orange", "bg-green"];

function Dot({ tone }: { tone: string }) {
  return (
    <span className={`flex size-3.5 shrink-0 items-center justify-center rounded-full text-white ${tone}`}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    </span>
  );
}

export function ThinkingState({
  variant = "Steps",
  active = false,
  rows = [],
  query,
  activeLabel,
  doneLabel,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  onSettled,
}: {
  variant?: ThinkingVariant;
  active?: boolean;
  rows?: ThinkingRow[];
  query?: string;
  activeLabel?: string;
  doneLabel?: string;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onSettled?: () => void;
}) {
  const labels = DEFAULT_LABELS[variant];
  const resolvedActiveLabel = activeLabel ?? labels.active;
  const resolvedDoneLabel = doneLabel ?? labels.done;

  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? internalExpanded;
  const toggle = () => {
    if (expanded !== undefined) {
      onExpandedChange?.(!expanded);
    } else {
      setInternalExpanded((v) => !v);
    }
  };

  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const traceRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);
  useLayoutEffect(() => {
    if (variant === "Reasoning") return;
    if (traceRef.current) setLineHeight(traceRef.current.offsetHeight);
  }, [rows, isExpanded, variant]);

  /* 轨迹 settle 时通知调用方（active 由 true 变 false 的瞬间） */
  const prevActiveRef = useRef(active);
  useEffect(() => {
    if (prevActiveRef.current && !active) onSettled?.();
    prevActiveRef.current = active;
  }, [active, onSettled]);

  return (
    <div
      key={variant}
      className={`flex w-full flex-col ${variant === "Reasoning" ? "" : "max-w-[380px]"}`}
      style={{
        minHeight: variant !== "Reasoning" && isExpanded ? 176 : undefined,
        transition: "min-height 400ms cubic-bezier(0.23,1,0.32,1)",
      }}
    >
      {/* header — 各变体共用 */}
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={toggle}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-control px-1.5 py-1
          transition-colors duration-100 hover:bg-hover-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "var(--ink-2)" : "var(--ink-3)"}>
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
        </svg>
        <span role="status" className="contents">
          {active ? (
            <span
              className="bg-clip-text text-[13px] font-medium whitespace-nowrap text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--ink-3) 35%, var(--ink) 50%, var(--ink-3) 65%)",
                backgroundSize: "200% 100%",
                animation: "shimmer-text 1.4s linear infinite",
              }}
            >
              {resolvedActiveLabel}
            </span>
          ) : (
            <span
              className="text-[13px] font-medium whitespace-nowrap text-ink-2"
              style={{ animation: "fade-in 350ms ease-out both" }}
            >
              {resolvedDoneLabel}
            </span>
          )}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          className="transition-transform duration-300"
          style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* 可展开轨迹 */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-[400ms]"
        style={{
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          opacity: isExpanded ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className={variant === "Reasoning" ? "relative mt-1" : "relative mt-1 ml-[5px] pl-4"}>
            {variant !== "Reasoning" && (
              <span
                aria-hidden
                className="absolute left-[3px] w-px bg-line"
                style={{ top: -8, height: lineHeight ? lineHeight - 2 : 0, transition: "height 500ms cubic-bezier(0.23,1,0.32,1)" }}
              />
            )}
            <div ref={traceRef} className="flex flex-col gap-1 py-1">
              {query && (
                <div className="flex h-6 items-center gap-2 px-1.5" style={{ animation: isExpanded ? "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" : undefined }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  <span className="text-[12.5px] text-ink-2">{query}</span>
                </div>
              )}
              {rows.map((row, i) => {
                if (variant === "Reasoning") {
                  return <StreamingText key={row.primary} content={row.primary} streaming={active} />;
                }
                const primaryClass = `min-w-0 truncate text-[12.5px] font-medium text-ink ${variant === "Search" ? "animated-underline" : ""}`;
                const content = (
                  <>
                    {variant === "Search" && <Dot tone={TONES[i % 3]} />}
                    {variant === "Steps" &&
                      (i < rows.length - 1 || !active ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <span className="size-3 shrink-0 rounded-full border-[1.5px] border-line-strong border-t-ink-2" style={{ animation: "spin 700ms linear infinite" }} />
                      ))}
                    <span className={primaryClass}>
                      {row.primary}
                    </span>
                    {row.secondary && (
                      <span className={`shrink-0 text-[11.5px] text-ink-3 ${row.mono ? "font-mono" : ""}`}>
                        {row.secondary}
                      </span>
                    )}
                    {row.add !== undefined && (
                      <span className="shrink-0 font-mono text-[11px] tabular-nums">
                        <span className="text-green">+{row.add}</span>{" "}
                        <span className="text-red">−{row.del}</span>
                      </span>
                    )}
                  </>
                );
                const rowClass = "flex min-h-7 w-full items-center gap-2 rounded-[6px] px-1.5 py-0.5 text-left";
                const animation = { animation: `fade-up 320ms cubic-bezier(0.23,1,0.32,1) ${i * 120}ms both` };

                if (variant === "Search") {
                  return (
                    <a
                      key={row.primary}
                      href={row.href}
                      target="_blank"
                      rel="noreferrer"
                      className={`${rowClass} transition-colors duration-150 hover:bg-hover`}
                      style={animation}
                    >
                      {content}
                    </a>
                  );
                }

                if (variant === "Coding") {
                  const selected = selectedTool === row.primary;
                  return (
                    <div key={row.primary} style={animation}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedTool(selected ? null : row.primary)}
                        className={`${rowClass} transition-colors duration-150 ${selected ? "bg-inset" : "hover:bg-hover"}`}
                      >
                        {content}
                      </button>
                      {selected && row.output && (
                        <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-[6px] bg-inset px-2.5 py-2 font-mono text-[11px] leading-5 text-ink-2">
                          {row.output}
                        </pre>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={row.primary} className={rowClass} style={animation}>
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
