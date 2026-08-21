import * as React from "react";
import { Bot, GitBranch, GitFork, RefreshCw, User, Wrench, X } from "lucide-react";
import { useChatStore } from "@/store/chat";
import type { SessionTreeNode } from "@/lib/pi-types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ─────────────────────────────────────────────────────────
 * SESSION TREE — 会话树面板
 * 可视化消息树：当前分支高亮，任意节点可 fork 分叉、
 * 复制当前分支（clone）。数据来自 get_tree RPC。
 * ───────────────────────────────────────────────────────── */

function nodeInfo(entry: SessionTreeNode["entry"]): { label: string; kind: "user" | "assistant" | "tool" | "meta"; toolName?: string } {
  const msg = entry.message;
  if (!msg) {
    if (entry.type === "model_change") return { label: `切换模型：${entry.modelId ?? ""}`, kind: "meta" };
    if (entry.type === "thinking_level_change") return { label: `思考等级：${entry.thinkingLevel ?? ""}`, kind: "meta" };
    if (entry.type === "compaction") return { label: "上下文压缩", kind: "meta" };
    if (entry.type === "branch_summary" || entry.type === "branchSummary") return { label: "分支摘要", kind: "meta" };
    return { label: entry.type, kind: "meta" };
  }
  const role = (msg as Record<string, unknown>).role;
  if (role === "user") {
    const content = (msg as Record<string, unknown>).content;
    const text = typeof content === "string" ? content : Array.isArray(content)
      ? (content as Array<Record<string, unknown>>).map((b) => String(b.text ?? "")).join(" ")
      : "";
    return { label: text.trim().slice(0, 60) || "(图片)", kind: "user" };
  }
  if (role === "assistant") {
    const content = (msg as Record<string, unknown>).content;
    const text = Array.isArray(content)
      ? (content as Array<Record<string, unknown>>)
          .filter((b) => b.type === "text")
          .map((b) => String(b.text ?? ""))
          .join(" ")
      : "";
    return { label: text.trim().slice(0, 60) || "…", kind: "assistant" };
  }
  if (role === "toolResult") {
    const toolName = String((msg as Record<string, unknown>).toolName ?? "");
    return { label: `工具：${toolName}`, kind: "tool", toolName };
  }
  return { label: String(role ?? ""), kind: "meta" };
}

function nodeIcon(kind: "user" | "assistant" | "tool" | "meta", toolName?: string) {
  if (kind === "user") return { Icon: User, cls: "text-sky-500" };
  if (kind === "assistant") return { Icon: Bot, cls: "text-violet-500" };
  if (kind === "tool") return { Icon: Wrench, cls: toolName === "bash" ? "text-emerald-500" : "text-amber-500" };
  return { Icon: GitBranch, cls: "text-ink-3/70" };
}

function TreeNode({
  node,
  depth,
  leafId,
  onFork,
  onLocate,
}: {
  node: SessionTreeNode;
  depth: number;
  leafId: string | null;
  onFork: (entryId: string) => void;
  onLocate?: (messageId: string | null) => void;
}) {
  const isLeaf = node.entry.id === leafId;
  const isMessage = node.entry.type === "message";
  const info = nodeInfo(node.entry);
  const { Icon, cls } = nodeIcon(info.kind, info.toolName);
  const messageId = isMessage ? String((node.entry.message as Record<string, unknown>)?.id ?? "") || null : null;

  return (
    <div>
      <div
        className={cn(
          "group flex items-start gap-2 rounded-[6px] py-1 pl-1 pr-1.5 transition-colors hover:bg-hover",
          isLeaf && "bg-accent-tint",
          isMessage && "cursor-pointer",
        )}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={() => {
          if (isMessage && onLocate) onLocate(messageId);
        }}
      >
        <span className={cn("mt-0.5 shrink-0", isMessage ? cls : "text-ink-3/60")}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className={cn("min-w-0 flex-1 truncate text-[12px]", isLeaf ? "font-medium text-ink" : "text-ink-2")}>
          {info.label}
        </span>
        {isLeaf && <span className="shrink-0 rounded bg-green-tint px-1 text-[10px] text-green">当前</span>}
        {isMessage && (
          <button
            type="button"
            aria-label="从此处 fork"
            title="从此处分叉"
            onClick={(e) => {
              e.stopPropagation();
              onFork(node.entry.id);
            }}
            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <GitFork className="h-3.5 w-3.5 text-ink-3 hover:text-ink" />
          </button>
        )}
      </div>
      {node.children.map((child) => (
        <TreeNode key={child.entry.id} node={child} depth={depth + 1} leafId={leafId} onFork={onFork} onLocate={onLocate} />
      ))}
    </div>
  );
}

export function SessionTreeDialog() {
  const open = useChatStore((s) => s.isTreeDialogOpen);
  const setOpen = useChatStore((s) => s.setTreeDialogOpen);
  const getTree = useChatStore((s) => s.getTree);
  const fork = useChatStore((s) => s.fork);
  const clone = useChatStore((s) => s.clone);
  const [tree, setTree] = React.useState<SessionTreeNode[]>([]);
  const [leafId, setLeafId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await getTree();
    setLoading(false);
    if (res) {
      setTree(res.tree);
      setLeafId(res.leafId);
    }
  }, [getTree]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const handleFork = async (entryId: string) => {
    if (busy) return;
    setBusy(entryId);
    await fork(entryId);
    setBusy(null);
    setOpen(false);
  };

  const handleLocate = (messageId: string | null) => {
    setOpen(false);
    if (!messageId) return;
    // 等弹窗关闭后再定位
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader className="border-b px-5 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-5 w-5" />
              会话树
            </DialogTitle>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => void load()}>
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                刷新
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={async () => {
                  if (await clone()) setOpen(false);
                }}
              >
                <GitFork className="h-3.5 w-3.5" />
                复制当前分支
              </Button>
            </div>
          </div>
          <DialogDescription>点击消息节点定位到对应消息；任意消息节点 hover 可 fork 分叉；「当前」为活跃分支末端。</DialogDescription>
        </DialogHeader>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {tree.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-12 text-sm text-muted-foreground">
              <X className="h-5 w-5" />
              会话为空
            </div>
          ) : (
            tree.map((node) => (
              <TreeNode key={node.entry.id} node={node} depth={0} leafId={leafId} onFork={handleFork} onLocate={handleLocate} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
