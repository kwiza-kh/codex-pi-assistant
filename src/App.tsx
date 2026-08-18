import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "@/store/chat";
import { Sidebar } from "@/components/Sidebar";
import { ChatHeader } from "@/components/ChatHeader";
import { ChatView } from "@/components/ChatView";
import { Composer } from "@/components/Composer";
import { CommandPalette } from "@/components/CommandPalette";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ExtensionUiDialog } from "@/components/ExtensionUiDialog";
import { ModelProviderDialog } from "@/components/ModelProviderDialog";
import { TooltipProvider } from "@/components/ui/tooltip";

function applyTheme(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function resolvePiServerUrl(): Promise<string> {
  // 纯浏览器开发：可通过环境变量指定
  const envUrl = import.meta.env.VITE_PI_SERVER_URL as string | undefined;
  if (envUrl) return envUrl;

  // Tauri 桌面端：让 Rust 启动 pi-server 并返回端口
  if (isTauriRuntime()) {
    try {
      const port = await invoke<number>("spawn_pi_server");
      return `ws://127.0.0.1:${port}`;
    } catch (err) {
      console.warn("Tauri 启动 pi-server 失败，回退到默认端口：", err);
    }
  }

  const port = Number(import.meta.env.VITE_PI_SERVER_PORT ?? 8787);
  return `ws://127.0.0.1:${port}`;
}

export default function App() {
  const settingsTheme = useChatStore((s) => s.settingsTheme);
  const connect = useChatStore((s) => s.connect);
  const disconnect = useChatStore((s) => s.disconnect);
  const status = useChatStore((s) => s.status);
  const lastError = useChatStore((s) => s.lastError);
  const setCommandPaletteOpen = useChatStore((s) => s.setCommandPaletteOpen);
  const notice = useChatStore((s) => s.notice);
  const clearNotice = useChatStore((s) => s.clearNotice);

  React.useEffect(() => {
    applyTheme(settingsTheme);
  }, [settingsTheme]);

  React.useEffect(() => {
    if (settingsTheme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settingsTheme]);

  React.useEffect(() => {
    let url = "";
    resolvePiServerUrl().then((resolved) => {
      url = resolved;
      connect(resolved);
    });
    return () => {
      void url;
      disconnect();
    };
  }, [connect, disconnect]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!useChatStore.getState().isCommandPaletteOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandPaletteOpen]);

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <ChatHeader />
          {status === "error" && lastError && (
            <div className="border-b bg-red-tint px-4 py-2 text-xs text-destructive">
              {lastError}
            </div>
          )}
          {notice && (
            <div className="flex items-center justify-between border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
              <span>{notice}</span>
              <button type="button" onClick={clearNotice} className="ml-4 shrink-0 opacity-60 hover:opacity-100">
                ✕
              </button>
            </div>
          )}
          <ChatView />
          <Composer />
        </div>
      </div>
      <CommandPalette />
      <SettingsDialog />
      <ExtensionUiDialog />
      <ModelProviderDialog />
    </TooltipProvider>
  );
}
