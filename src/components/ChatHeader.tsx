import { Boxes, Menu, Monitor, Moon, Search, Settings, Sun } from "lucide-react";
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

export function ChatHeader() {
  const model = useChatStore((s) => s.model);
  const thinkingLevel = useChatStore((s) => s.thinkingLevel);
  const sessionName = useChatStore((s) => s.sessionName);
  const status = useChatStore((s) => s.status);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const setCommandPaletteOpen = useChatStore((s) => s.setCommandPaletteOpen);
  const setSettingsOpen = useChatStore((s) => s.setSettingsOpen);
  const setModelDialogOpen = useChatStore((s) => s.setModelDialogOpen);
  const settingsTheme = useChatStore((s) => s.settingsTheme);
  const setSettingsTheme = useChatStore((s) => s.setSettingsTheme);

  const statusText =
    status === "connected" ? "已连接" : status === "connecting" ? "连接中" : "未连接";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-dashed border-line bg-page px-3 backdrop-blur-md sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="打开侧栏"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="truncate text-sm font-medium text-foreground">{sessionName ?? "Pi 会话"}</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-chip bg-field px-2 py-0.5 text-[11px] shadow-btn ${
            status === "connected" ? "text-green" : "text-ink-2"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "connected" ? "bg-emerald-500" : status === "connecting" ? "bg-amber-500" : "bg-red-500"
            }`}
          />
          {statusText}
        </span>
        {model && (
          <span className="hidden rounded-chip bg-field px-2 py-0.5 text-[11px] text-ink-2 shadow-btn sm:inline-block">
            {model.name} · {thinkingLevel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="搜索与命令"
            >
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>搜索与命令（Ctrl+K）</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="切换主题">
              {settingsTheme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : settingsTheme === "light" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>外观</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSettingsTheme("light")}>
              <Sun />
              浅色
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSettingsTheme("dark")}>
              <Moon />
              深色
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSettingsTheme("system")}>
              <Monitor />
              跟随系统
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setModelDialogOpen(true)}
              aria-label="模型与接入商"
            >
              <Boxes className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>模型与接入商</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label="设置">
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>设置</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
