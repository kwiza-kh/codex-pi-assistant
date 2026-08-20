import * as React from "react";
import { FileText, Save } from "lucide-react";
import { useChatStore } from "@/store/chat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/* ─────────────────────────────────────────────────────────
 * CONTEXT FILE EDITOR — 项目指令（AGENTS.md / CLAUDE.md）
 * 编辑 Pi 启动时加载的项目上下文文件，保存后写入工作目录。
 * ───────────────────────────────────────────────────────── */

export function ContextFileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const getContextFile = useChatStore((s) => s.getContextFile);
  const setContextFile = useChatStore((s) => s.setContextFile);
  const setNotice = useChatStore((s) => s.setNotice);
  const [path, setPath] = React.useState("");
  const [content, setContent] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    void getContextFile().then((res) => {
      setLoading(false);
      if (res) {
        setPath(res.path);
        setContent(res.content);
      }
    });
  }, [open, getContextFile]);

  const save = async () => {
    setSaving(true);
    const res = await setContextFile(content);
    setSaving(false);
    if (res) {
      setNotice(`已保存项目指令：${res.path}`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            项目指令
          </DialogTitle>
          <DialogDescription className="truncate font-mono text-[11px]">
            {path || "AGENTS.md（保存后创建）"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">加载中…</div>
          ) : (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# 项目指令&#10;&#10;在这里描述项目的编码约定、架构、约束等。Pi 每次启动都会加载这些指令。"
              className="scrollbar-thin min-h-0 flex-1 resize-none font-mono text-xs leading-6"
            />
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={saving || loading}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
