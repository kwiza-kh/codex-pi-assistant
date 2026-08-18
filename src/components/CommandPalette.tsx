import * as React from "react";
import { ListChecks, MessageSquare, Moon, Plus, Search, Settings, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import { Input } from "@/components/ui/input";

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
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

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
  }, [query, sessions, commands, sessionId, settingsTheme]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  React.useEffect(() => setCursor(0), [query]);

  React.useEffect(() => {
    listRef.current?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

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
      <div className="relative w-full max-w-xl overflow-hidden rounded-window border-0 bg-surface text-ink shadow-overlay animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
        <div className="flex items-center border-b border-dashed border-line px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索会话、Pi 命令，或执行操作…"
            className="h-12 border-0 bg-transparent px-0 text-base text-ink shadow-none focus-visible:ring-0"
          />
          <kbd className="ml-2 shrink-0 rounded-chip bg-field px-1.5 py-0.5 text-[10px] font-medium text-ink-2 shadow-btn">
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="scrollbar-thin max-h-[360px] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">未找到相关内容</div>
          ) : (
            items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                data-cursor={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onClick={item.onSelect}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  i === cursor && "bg-accent text-accent-foreground"
                )}
              >
                <span className="shrink-0 text-muted-foreground">{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.label}</span>
                  {item.desc && <span className="block truncate text-xs text-muted-foreground">{item.desc}</span>}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-ink-3">
                  {item.group}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
