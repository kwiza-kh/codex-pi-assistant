import { useState } from "react";

/* ─────────────────────────────────────────────────────────
 * TASK ROWS — 任务行列表
 *
 * 两种布局：
 *   Capsules — 每行是一个圆角胶囊卡，行间留白
 *   List     — 平铺列表，行间以 border 分隔
 *
 * 每行含状态徽章（pending 圆环 / running 扫环 / failed 红叉 /
 * done 绿勾）、标签、数量、状态 pill，展开后下拉显示明细。
 * 状态由调用方通过 rows 的 status 传入，不做本地定时器
 * 模拟时序；任务详情在完成后仍可点击展开。
 * ───────────────────────────────────────────────────────── */

export type TaskStatus = "pending" | "running" | "failed" | "done";

export type TaskDetail = { label: string; meta: string };

export type TaskRow = {
  key: string;
  label: string;
  amount?: string;
  status: TaskStatus;
  details?: TaskDetail[];
  /** 默认展开（例如当前正在执行的行） */
  defaultExpanded?: boolean;
};

export type TaskRowsVariant = "Capsules" | "List";

function SpinnerRing({ active, children }: { active?: boolean; children?: React.ReactNode }) {
  const size = 24, stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size} height={size} className="absolute inset-0"
        style={active ? { animation: "spin 1.1s linear infinite" } : undefined}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        {active && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="var(--ink-3)" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${c * 0.28} ${c * 0.72}`}
          />
        )}
      </svg>
      <span className="relative text-[10.5px] font-semibold tabular-nums text-ink">{children}</span>
    </span>
  );
}

function Badge({ tone, children }: { tone: "red" | "green"; children: React.ReactNode }) {
  return (
    <span
      className={`flex size-[22px] shrink-0 items-center justify-center rounded-full text-white
        ${tone === "red" ? "bg-red" : "bg-green"}`}
      style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      {children}
    </span>
  );
}

const XIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
);
const CheckIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
);
const RetryIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
);

export function TaskRows({
  rows,
  variant = "Capsules",
  onRetry,
}: {
  rows: TaskRow[];
  variant?: TaskRowsVariant;
  onRetry?: (key: string) => void;
}) {
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const list = variant === "List";

  return (
    <div
      className={`flex w-full max-w-[440px] flex-col ${
        list ? "gap-0 self-start overflow-hidden rounded-window bg-surface shadow-card" : "min-h-[196px] gap-2"
      }`}
    >
      {rows.map((row, i) => {
        const open = manualOpen[row.key] ?? Boolean(row.defaultExpanded);
        const badge =
          row.status === "failed" ? (
            <Badge tone="red">{XIcon}</Badge>
          ) : row.status === "done" ? (
            <Badge tone="green">{CheckIcon}</Badge>
          ) : (
            <SpinnerRing active={row.status === "running"}>{i + 1}</SpinnerRing>
          );
        const pill =
          row.status === "failed" ? (
            <button
              type="button"
              disabled={!onRetry}
              onClick={() => onRetry?.(row.key)}
              className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-red-tint px-2 text-[11.5px] font-medium text-red disabled:cursor-default"
              style={{ animation: "fade-in 200ms ease-out both" }}
            >
              失败
              <span className="flex">{RetryIcon}</span>
            </button>
          ) : row.status === "done" ? (
            <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-green-tint px-2 text-[11.5px] font-medium text-green" style={{ animation: "fade-in 200ms ease-out both" }}>
              完成
            </span>
          ) : null;

        return (
          <div
            key={row.key}
            className={`self-stretch overflow-hidden transition-[border-radius,background-color] duration-300 hover:bg-inset ${
              list ? "border-b border-line last:border-0" : "bg-surface shadow-card"
            }`}
            style={{
              borderRadius: list ? 0 : open ? 14 : 22,
              animation: `fade-up 450ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms both`,
            }}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setManualOpen((current) => ({ ...current, [row.key]: !open }))}
              className="flex h-11 w-full items-center gap-2.5 px-2.5 text-left"
            >
              <span className="flex size-6 shrink-0 items-center justify-center">
                {badge}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                {row.label}
              </span>
              {row.amount && <span className="text-[12.5px] text-ink-2 tabular-nums">{row.amount}</span>}
              {pill}
              <span
                aria-hidden="true"
                className="-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-3"
              >
                <svg
                  width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  className="transition-transform duration-300"
                  style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>

            {/* 下拉明细 — 与 Chain of Thought 相同的展开语法 */}
            <div
              className="grid transition-[grid-template-rows,opacity] duration-300"
              style={{
                gridTemplateRows: open ? "1fr" : "0fr",
                opacity: open ? 1 : 0,
                transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
              }}
            >
              <div className="overflow-hidden">
                <div className="mb-2.5 grid grid-cols-[24px_1fr] gap-2.5 px-2.5">
                  <span aria-hidden className="mx-auto h-full w-px bg-line" />
                  <div className="flex flex-col gap-1.5">
                    {(row.details ?? []).map((d, j) => (
                      <div
                        key={d.label}
                        className="flex items-center justify-between"
                        style={
                          open
                            ? { animation: `fade-up 300ms cubic-bezier(0.23,1,0.32,1) ${120 + j * 100}ms both` }
                            : undefined
                        }
                      >
                        <span className="text-[12px] text-ink-2">{d.label}</span>
                        <span className="font-mono text-[11.5px] text-ink-3 tabular-nums">
                          {d.meta}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
