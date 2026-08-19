import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  MessageSquare,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn, truncateTitle } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import type { SessionInfo } from "@/lib/pi-types";

/* ─────────────────────────────────────────────────────────
 * SIDEBAR NAV — 侧边栏导航
 * 紧凑的工作区标题栏、主导航、可搜索的会话历史，
 * 以及保留图标对齐的折叠（展开 224px ↔ 折叠 52px）。
 * 会话数据来自 Pi（switchSession 切换），折叠与滑片
 * 高亮为本地交互，不依赖外部 primitives。
 * ───────────────────────────────────────────────────────── */

const SIDEBAR_MOTION = {
  expandedWidth: 224,
  collapsedWidth: 52,
  duration: 280,
  copyDuration: 180,
  copyOffset: 8,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

/* 单个高亮滑片滑到 hover 行，而不是每行各自切换背景 */
function GlideGroup({ children, className }: { children: ReactNode; className?: string }) {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const onMouseOver = (event: React.MouseEvent) => {
    const container = ref.current;
    if (!container) return;
    const row = (event.target as Element).closest("[data-row]");
    if (!row || !container.contains(row)) return;
    const r = (row as HTMLElement).getBoundingClientRect();
    const c = container.getBoundingClientRect();
    setBox({ top: r.top - c.top, height: r.height });
  };

  return (
    <div
      ref={ref}
      onMouseOver={onMouseOver}
      onMouseLeave={() => setBox(null)}
      className={cn("group/glide relative", className)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-2 z-0 rounded-[7px] bg-hover-2 transition-[top,height,opacity] duration-200"
        style={{
          top: box?.top ?? 0,
          height: box?.height ?? 0,
          opacity: box ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
        }}
      />
      {children}
    </div>
  );
}

function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="sidebar-copy mx-2 flex h-8 items-center justify-between px-2 text-[12.5px] font-medium text-ink-3">
      <span className="flex items-center gap-1">
        <ChevronDown size={13} />
        {children}
      </span>
      {action}
    </div>
  );
}

function SessionRow({ session }: { session: SessionInfo }) {
  const sessionId = useChatStore((s) => s.sessionId);
  const switchSession = useChatStore((s) => s.switchSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const active = session.id === sessionId;
  const title = truncateTitle(session.title || session.id, 24);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const onDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteSession(session.path);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <button
      data-row
      type="button"
      title={`${session.title || session.id}${session.cwd ? ` · ${session.cwd}` : ""}`}
      onClick={() => {
        if (!active && !confirming) switchSession(session.path);
      }}
      onMouseLeave={() => setConfirming(false)}
      className={cn(
        "sidebar-row group relative z-10 mx-2 flex h-8 items-center rounded-[8px] px-2 text-left transition-[width,background-color,color,transform] duration-150 active:scale-[0.96]",
        active ? "bg-hover-2 group-hover/glide:bg-transparent" : "",
      )}
    >
      <MessageSquare className={cn("size-4 shrink-0", active ? "text-ink" : "text-ink-3")} />
      <span className={cn("sidebar-copy ml-1.5 min-w-0 flex-1 truncate text-[13.5px] font-medium", active ? "text-ink" : "text-ink-2")}>
        {title}
      </span>
      {confirming ? (
        <span
          role="button"
          aria-label="确认删除会话"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={cn(
            "flex h-5 shrink-0 items-center gap-1 rounded-[6px] px-1.5 text-[11px] font-semibold text-red transition-colors hover:bg-red-tint",
            deleting && "opacity-50",
          )}
        >
          <AlertTriangle size={13} />
          {deleting ? "删除中" : "确认"}
        </span>
      ) : (
        <span
          role="button"
          aria-label="删除会话"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-ink-3 opacity-0 transition-all duration-150 hover:bg-red-tint hover:text-red group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </span>
      )}
    </button>
  );
}

export function Sidebar() {
  const isOpen = useChatStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const newSession = useChatStore((s) => s.newSession);
  const sessions = useChatStore((s) => s.sessions);
  const refreshSessions = useChatStore((s) => s.refreshSessions);
  const status = useChatStore((s) => s.status);
  const setSettingsOpen = useChatStore((s) => s.setSettingsOpen);

  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? sessions.filter((s) => (s.title || s.id).toLowerCase().includes(query.trim().toLowerCase()))
    : sessions;

  const statusDot =
    status === "connected" ? "bg-emerald-500" : status === "connecting" ? "bg-amber-500" : "bg-red-500";
  const statusText =
    status === "connected" ? "已连接" : status === "connecting" ? "连接中…" : "未连接";

  const nav = (
    <aside
      data-sidebar-collapsed={collapsed}
      aria-label="会话导航"
      className="relative h-full shrink-0 overflow-hidden bg-canvas text-ink"
      style={
        {
          width: collapsed ? SIDEBAR_MOTION.collapsedWidth : SIDEBAR_MOTION.expandedWidth,
          transitionDuration: `${SIDEBAR_MOTION.duration}ms`,
          transitionTimingFunction: SIDEBAR_MOTION.easing,
          "--sidebar-copy-duration": `${SIDEBAR_MOTION.copyDuration}ms`,
          "--sidebar-copy-offset": `${SIDEBAR_MOTION.copyOffset}px`,
          "--sidebar-easing": SIDEBAR_MOTION.easing,
        } as CSSProperties
      }
    >
      <div className="flex h-full w-[224px] flex-col pb-2.5">
        {/* 标题行：logo + 折叠/展开 */}
        <div className="relative mb-2.5 h-10 shrink-0">
          <div
            aria-hidden={collapsed}
            className="absolute left-2 top-1 flex h-8 items-center rounded-[8px] px-2 text-left"
          >
            <span className="flex size-5 shrink-0 items-center justify-center text-ink">
              <Sparkles size={18} />
            </span>
            <span className="sidebar-copy ml-1.5 min-w-0 flex-1 truncate text-[14px] font-semibold tracking-tight text-ink">
              Pi
            </span>
          </div>

          <button
            type="button"
            aria-label="折叠侧边栏"
            aria-hidden={collapsed}
            tabIndex={collapsed ? -1 : 0}
            onClick={() => setCollapsed(true)}
            className="sidebar-collapse-control absolute right-2 top-1 flex size-8 items-center justify-center rounded-[8px] text-ink-3 transition-[opacity,background-color,color,transform] duration-150 hover:bg-hover-2 hover:text-ink active:scale-[0.96]"
          >
            <PanelLeftClose size={18} />
          </button>
          <button
            type="button"
            aria-label="展开侧边栏"
            aria-hidden={!collapsed}
            tabIndex={collapsed ? 0 : -1}
            onClick={() => setCollapsed(false)}
            className="sidebar-expand-control absolute left-2 top-0.5 flex size-9 items-center justify-center rounded-[8px] text-ink-3 transition-[opacity,background-color,color,transform] duration-150 hover:bg-hover-2 hover:text-ink active:scale-[0.96]"
          >
            <PanelLeftOpen size={18} />
          </button>
        </div>

        {/* 主导航：新会话 */}
        <GlideGroup className="flex flex-col gap-px">
          <button
            data-row
            type="button"
            onClick={() => newSession()}
            className="sidebar-row relative z-10 mx-2 flex h-8 items-center rounded-[8px] px-2 text-left transition-[width,background-color,color,transform] duration-150 active:scale-[0.96]"
          >
            <span className="flex size-5 shrink-0 items-center justify-center text-ink-2">
              <MessageSquarePlus size={18} />
            </span>
            <span className="sidebar-copy ml-1.5 min-w-0 flex-1 truncate text-[14px] font-medium text-ink-2">
              新会话
            </span>
          </button>
        </GlideGroup>

        {/* 会话历史 */}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <SectionLabel
            action={
              <span className="flex items-center">
                <button
                  type="button"
                  aria-label="刷新会话列表"
                  onClick={() => refreshSessions()}
                  className="flex size-7 items-center justify-center rounded-[7px] text-ink-3 transition-colors duration-150 hover:bg-hover-2 hover:text-ink"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  type="button"
                  aria-label={searchOpen ? "关闭会话搜索" : "搜索会话"}
                  aria-expanded={searchOpen}
                  onClick={() => {
                    setSearchOpen((open) => !open);
                    if (searchOpen) setQuery("");
                  }}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-[7px] transition-colors duration-150",
                    searchOpen ? "bg-hover-2 text-ink" : "text-ink-3 hover:bg-hover-2 hover:text-ink",
                  )}
                >
                  <Search size={16} />
                </button>
              </span>
            }
          >
            会话
          </SectionLabel>

          {searchOpen && (
            <div className="sidebar-copy mx-2 mb-1 px-2" style={{ animation: "fade-in 140ms ease-out both" }}>
              <div className="flex h-8 items-center gap-1.5 rounded-[8px] bg-field px-2 text-ink-3 shadow-hairline focus-within:text-ink-2">
                <Search size={14} />
                <input
                  ref={searchRef}
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setSearchOpen(false);
                      setQuery("");
                    }
                  }}
                  placeholder="搜索会话…"
                  aria-label="搜索会话历史"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
                />
              </div>
            </div>
          )}

          <GlideGroup className="flex flex-col gap-px">
            {filtered.length === 0 ? (
              <div className="sidebar-copy mx-2 px-2 py-2 text-[12.5px] text-ink-3">
                {query.trim() ? "未找到匹配的会话" : "暂无会话记录"}
              </div>
            ) : (
              filtered.map((s) => <SessionRow key={s.id + s.path} session={s} />)
            )}
          </GlideGroup>
        </div>

        {/* 底部：连接状态 + 设置 */}
        <div className="sidebar-copy mx-2 mt-3 border-t border-line pt-2">
          <div className="flex h-8 items-center gap-2 px-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", statusDot)} />
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink-2">{statusText}</span>
            <button
              type="button"
              aria-label="设置"
              onClick={() => setSettingsOpen(true)}
              className="flex size-7 shrink-0 items-center justify-center rounded-[7px] text-ink-3 transition-colors duration-150 hover:bg-hover-2 hover:text-ink"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden h-full shrink-0 md:block">{nav}</div>
      {/* 移动端抽屉 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex">
            <div className="flex h-full flex-col">
              {nav}
              <button
                type="button"
                aria-label="关闭侧栏"
                onClick={() => setSidebarOpen(false)}
                className="absolute left-[232px] top-3 flex size-8 items-center justify-center rounded-full bg-surface text-ink-2 shadow-card transition-colors hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
