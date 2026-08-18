import * as React from "react";
import {
  FolderGit2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { cn, truncateTitle } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import type { SessionInfo } from "@/lib/pi-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function SessionItem({ session }: { session: SessionInfo }) {
  const sessionId = useChatStore((s) => s.sessionId);
  const switchSession = useChatStore((s) => s.switchSession);
  const active = session.id === sessionId;
  const title = session.title || session.id;

  return (
    <button
      type="button"
      onClick={() => {
        if (!active) switchSession(session.path);
      }}
      className={cn(
        "group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors",
        active ? "bg-hover-2 shadow-btn" : "hover:bg-hover"
      )}
    >
      <MessageSquare
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          active ? "text-ink" : "text-ink-3"
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[13px]",
            active ? "font-medium text-ink" : "text-ink-2"
          )}
        >
          {truncateTitle(title, 26)}
        </span>
        <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-ink-3">
          <FolderGit2 className="h-3 w-3 shrink-0" />
          {session.cwd ? session.cwd.split(/[\\/]/).slice(-2).join("/") : "未知目录"}
        </span>
      </span>
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
  const cwd = useChatStore((s) => s.cwd);
  const sessionName = useChatStore((s) => s.sessionName);
  const setSettingsOpen = useChatStore((s) => s.setSettingsOpen);
  const [query, setQuery] = React.useState("");

  const filtered = query.trim()
    ? sessions.filter((s) => (s.title || s.id).toLowerCase().includes(query.trim().toLowerCase()))
    : sessions;

  const statusDot =
    status === "connected" ? "bg-emerald-500" : status === "connecting" ? "bg-amber-500" : "bg-red-500";

  const sidebar = (
    <aside className="flex h-full w-[280px] flex-col border-r border-dashed border-line bg-canvas text-ink">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-control bg-ink text-page shadow-btn">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Codex</span>
          <span className="rounded-chip bg-field px-1.5 py-0.5 text-[10px] font-medium text-ink-2 shadow-btn">
            Pi
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-ink-3 hover:bg-hover hover:text-ink lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="关闭侧栏"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2 px-3 pb-3">
        <Button
          variant="sidebar"
          className="w-full justify-start gap-2 rounded-control shadow-btn"
          onClick={() => newSession()}
        >
          <Plus className="h-4 w-4" />
          新会话
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 Pi 会话…"
            className="h-9 border-0 bg-field pl-8 text-ink shadow-inset-field placeholder:text-ink-3 focus-visible:ring-line-strong"
          />
        </div>
      </div>

      <ScrollArea className="scrollbar-sidebar flex-1">
        <div className="px-3 pb-4">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-ink-3">
              会话历史
            </h3>
            <button
              type="button"
              onClick={() => refreshSessions()}
              className="text-ink-3 transition-colors hover:text-ink"
              aria-label="刷新会话列表"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
          {filtered.length === 0 ? (
            <div className="px-2 py-8 text-center text-xs text-ink-3">
              {query.trim() ? "未找到匹配的会话" : "暂无会话记录"}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((s) => (
                <SessionItem key={s.id + s.path} session={s} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-dashed border-line p-3">
        <div className="rounded-control px-2 py-1.5 text-[11px] leading-5 text-ink-2">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", statusDot)} />
            <span className="font-medium text-ink">
              {status === "connected" ? "Pi 已连接" : status === "connecting" ? "Pi 连接中…" : "Pi 未连接"}
            </span>
          </div>
          <div className="mt-0.5 truncate">会话：{sessionName ?? "未命名"}</div>
          <div className="truncate">目录：{cwd || "—"}</div>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">
            我
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">本地用户</div>
            <div className="truncate text-[11px] text-ink-3">Pi Agent 驱动</div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-ink-3 hover:bg-hover hover:text-ink"
                onClick={() => setSettingsOpen(true)}
                aria-label="设置"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">设置</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-full shrink-0 md:block">{sidebar}</div>
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 animate-in slide-in-from-left duration-200">{sidebar}</div>
        </div>
      )}
    </>
  );
}
