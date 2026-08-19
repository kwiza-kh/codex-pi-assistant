import * as React from "react";
import { ListChecks, MessageSquare, Moon, Plus, Search, Settings, Sun, X } from "lucide-react";
import { useChatStore } from "@/store/chat";

/* ─────────────────────────────────────────────────────────
 * SEARCH — 命令搜索，实时过滤
 * 输入框、清除按钮、结果均可直接使用；结果用单个滑片
 * 高亮滑到 hover / 键盘当前行。
 * ───────────────────────────────────────────────────────── */

interface CommandItem {
  id: string;
  group: "会话" | "命令" | "操作";
  label: string;
  desc?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

export function CommandPalette() {
  const open = useChatStore((s) => s.isCommandPaletteOpen);
  const setOpen = useChatStore((s) => s.setCommandPaletteOpen);
  const sessions = useChatStore((s) => s.sessions);
  const sessionId = useChatStore((s) => s.sessionId);
  const switchSession = useChatStore((s) => s.switchSession);
  const newSession = useChatStore((s) => s.newSession);
  const commands = useChatStore((s) => s.commands);
  const settingsTheme = useChatStore((s) => s.settingsTheme);
  const setSettingsTheme = useChatStore((s) => s.setSettingsTheme);
  const setSettingsOpen = useChatStore((s) => s.setSettingsOpen);

  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const [glide, setGlide] = React.useState<{ top: number; height: number } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const rowRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const items: CommandItem[] = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    const sessionItems: CommandItem[] = sessions
      .filter((s) => !q || (s.title || s.id).toLowerCase().includes(q))
      .slice(0, 6)
      .map((s) => ({
        id: `session:${s.id}`,
        group: "会话" as const,
        label: s.title || s.id,
        desc: s.cwd,
        icon: <MessageSquare className="h-4 w-4" />,
        onSelect: () => {
          if (s.id !== sessionId) switchSession(s.path);
          setOpen(false);
        },
      }));

    const commandItems: CommandItem[] = commands
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((c) => ({
        id: `cmd:${c.name}`,
        group: "命令" as const,
        label: `/${c.name}`,
        desc: c.description,
        icon: <ListChecks className="h-4 w-4" />,
        onSelect: () => {
          setOpen(false);
        },
      }));

    const actions: CommandItem[] = [
      {
        id: "action-new",
        group: "操作",
        label: "新建会话",
        icon: <Plus className="h-4 w-4" />,
        onSelect: () => {
          newSession();
          setOpen(false);
        },
      },
      {
        id: "action-theme",
        group: "操作",
        label: settingsTheme === "dark" ? "切换到浅色模式" : "切换到深色模式",
        icon: settingsTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
        onSelect: () => {
          setSettingsTheme(settingsTheme === "dark" ? "light" : "dark");
          setOpen(false);
        },
      },
      {
        id: "action-settings",
        group: "操作",
        label: "打开设置",
        icon: <Settings className="h-4 w-4" />,
        onSelect: () => {
          setSettingsOpen(true);
          setOpen(false);
        },
      },
    ];

    return [...sessionItems, ...commandItems, ...actions];
  }, [query, sessions, commands, sessionId, settingsTheme, switchSession, setOpen, newSession, setSettingsTheme, setSettingsOpen]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  React.useEffect(() => {
    setCursor(0);
    setGlide(null);
  }, [query]);

  React.useEffect(() => {
    listRef.current?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  /* 单个高亮滑片滑到当前行（hover 与键盘共用同一游标） */
  React.useLayoutEffect(() => {
    if (!open) return;
    const target = rowRefs.current[cursor];
    if (target) setGlide({ top: target.offsetTop, height: target.offsetHeight });
  }, [cursor, items.length, open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && items[cursor]) {
      e.preventDefault();
      items[cursor].onSelect();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-window bg-surface text-ink shadow-overlay animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
        {/* input 行 */}
        <div className="flex h-12 items-center gap-2 border-b border-line px-3 transition-colors duration-100 hover:bg-hover">
          <Search className="h-4 w-4 shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索会话、Pi 命令，或执行操作…"
            aria-label="搜索"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
          />
          {query && (
            <button
              aria-label="清除搜索"
              type="button"
              onClick={() => setQuery("")}
              className="flex size-6 items-center justify-center rounded-full text-ink-3 transition-colors duration-100 hover:bg-line/70 hover:text-ink"
              style={{ animation: "fade-in 150ms ease-out both" }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="ml-1 shrink-0 rounded-chip bg-field px-1.5 py-0.5 text-[10px] font-medium text-ink-2 shadow-btn">
            ESC
          </kbd>
        </div>

        {/* 结果 / 空状态 */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-10" style={{ animation: "fade-in 250ms ease-out both" }}>
            <span className="mb-1.5 flex size-8 items-center justify-center rounded-control bg-inset text-ink-3 shadow-hairline">
              <Search className="h-4 w-4" />
            </span>
            <span className="text-[13px] font-medium text-ink">未找到相关内容</span>
            <span className="text-[12px] text-ink-3">换个关键词再试试</span>
          </div>
        ) : (
          <div ref={listRef} className="scrollbar-thin relative max-h-[360px] overflow-y-auto p-1.5">
            {/* 单个高亮滑片 */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-1.5 z-0 rounded-[6px] bg-hover transition-[top,height,opacity] duration-200"
              style={{
                top: glide?.top ?? 0,
                height: glide?.height ?? 0,
                opacity: glide ? 1 : 0,
                transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
              }}
            />
            {items.map((item, i) => (
              <button
                key={item.id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                data-cursor={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onClick={item.onSelect}
                className="relative z-10 flex w-full items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-left"
              >
                <span className="shrink-0 text-ink-2">{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{item.label}</span>
                  {item.desc && <span className="block truncate text-[11.5px] text-ink-3">{item.desc}</span>}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-ink-3">
                  {item.group}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
