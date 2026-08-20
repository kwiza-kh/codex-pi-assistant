import * as React from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Mic,
  Plus,
  Square,
  X,
} from "lucide-react";
import { useChatStore } from "@/store/chat";
import { cn } from "@/lib/utils";
import type { PiImage } from "@/lib/pi-types";

/* ─────────────────────────────────────────────────────────
 * COMPOSER — 底部输入框
 * 单行集成控件 [+][输入框][模型][语音][发送]，与参考布局一致：
 * 输入 / 弹出命令菜单、模型选择器弹出菜单，均带滑片高亮。
 * 流式时发送键变为停止、语音位变为「后续消息」。
 * ───────────────────────────────────────────────────────── */

type CommandItem = { key: string; name: string; desc?: string };

/* 当前正在输入的最后一个 @词 或 /词，若有 */
function parseToken(draft: string): { kind: "at" | "slash"; query: string; start: number } | null {
  const match = /(^|\s)([@/])([\w./-]*)$/.exec(draft);
  if (!match) return null;
  return {
    kind: match[2] === "@" ? "at" : "slash",
    query: match[3].toLowerCase(),
    start: match.index + match[1].length,
  };
}

export function Composer() {
  const [value, setValue] = React.useState("");
  const [dismissed, setDismissed] = React.useState(false);
  const [modelOpen, setModelOpen] = React.useState(false);
  const [plusOpen, setPlusOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [engaged, setEngaged] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [rowBox, setRowBox] = React.useState<{ top: number; height: number } | null>(null);
  const [modelBox, setModelBox] = React.useState<{ top: number; height: number } | null>(null);
  const [modelHovered, setModelHovered] = React.useState<number | null>(null);
  const [modelMenuLeft, setModelMenuLeft] = React.useState(0);
  const [modelMenuBottom, setModelMenuBottom] = React.useState(0);
  const [attachments, setAttachments] = React.useState<PiImage[]>([]);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const composerAnchorRef = React.useRef<HTMLDivElement>(null);
  const controlsRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const modelRef = React.useRef<HTMLButtonElement>(null);
  const rowRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const modelRowRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // store
  const isStreaming = useChatStore((s) => s.isStreaming);
  const models = useChatStore((s) => s.models);
  const model = useChatStore((s) => s.model);
  const commands = useChatStore((s) => s.commands);
  const queue = useChatStore((s) => s.queue);
  const sendPrompt = useChatStore((s) => s.sendPrompt);
  const steer = useChatStore((s) => s.steer);
  const followUp = useChatStore((s) => s.followUp);
  const abort = useChatStore((s) => s.abort);
  const setModel = useChatStore((s) => s.setModel);
  const editorPrefill = useChatStore((s) => s.editorPrefill);
  const consumeEditorPrefill = useChatStore((s) => s.consumeEditorPrefill);
  const listWorkspaceFiles = useChatStore((s) => s.listWorkspaceFiles);

  const [workspaceFiles, setWorkspaceFiles] = React.useState<string[]>([]);

  const modelItems = models.map((m) => ({
    key: `${m.provider}/${m.id}`,
    name: m.name,
    tag: m.provider,
    provider: m.provider,
    id: m.id,
  }));
  const currentModelItem = model
    ? modelItems.find((m) => m.key === `${model.provider}/${model.id}`) ?? null
    : null;

  const commandItems: CommandItem[] = commands.map((c) => ({
    key: c.name,
    name: `/${c.name}`,
    desc: c.description,
  }));

  // 扩展 set_editor_text 预填输入框
  React.useEffect(() => {
    if (editorPrefill != null) {
      setValue(editorPrefill);
      consumeEditorPrefill();
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [editorPrefill, consumeEditorPrefill]);

  const token = dismissed ? null : parseToken(value);
  const menu: "at" | "slash" | null =
    token?.kind === "slash" && commandItems.length > 0 ? "slash" : token?.kind === "at" ? "at" : null;
  const query = token?.query ?? "";
  const rows: CommandItem[] =
    menu === "slash"
      ? commandItems.filter((c) => c.name.replace(/^\//, "").startsWith(query))
      : menu === "at"
        ? workspaceFiles
            .filter((f) => f.toLowerCase().includes(query))
            .slice(0, 20)
            .map((f) => ({ key: f, name: f }))
        : [];

  // 打开 @ 菜单时加载工作目录文件列表
  React.useEffect(() => {
    if (menu === "at") void listWorkspaceFiles().then(setWorkspaceFiles);
  }, [menu, listWorkspaceFiles]);

  const wide = expanded;

  React.useEffect(() => {
    setActive(0);
    setEngaged(false);
  }, [menu, query]);

  /* 单个高亮滑片滑到当前行，而不是每行各自切换背景 */
  React.useLayoutEffect(() => {
    const target = rowRefs.current[active];
    if (target) setRowBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [menu, query, active, rows.length]);

  /* 模型菜单里同样的滑片高亮，浮到 hover 行，回退到当前选中模型 */
  const modelIndex = modelItems.findIndex((m) => m.key === currentModelItem?.key);
  React.useLayoutEffect(() => {
    if (!modelOpen) return;
    const target = modelRowRefs.current[modelHovered ?? (modelIndex >= 0 ? modelIndex : 0)];
    if (target) setModelBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [modelOpen, modelHovered, modelIndex]);

  /* 菜单在裁剪框外，通过测量对齐到模型触发器，而不是钉死在右边缘 */
  React.useLayoutEffect(() => {
    if (!modelOpen || !composerAnchorRef.current || !modelRef.current) return;
    const anchorRect = composerAnchorRef.current.getBoundingClientRect();
    const triggerRect = modelRef.current.getBoundingClientRect();
    setModelMenuLeft(Math.max(0, Math.min(triggerRect.left - anchorRect.left, anchorRect.width - 176)));
    setModelMenuBottom(anchorRect.bottom - triggerRect.top + 8);
  }, [modelOpen, wide, currentModelItem?.name]);

  React.useEffect(() => {
    if (!modelOpen) setModelHovered(null);
  }, [modelOpen]);

  /* 换行文本上移到控件上方，随后增长到紧凑上限 */
  React.useLayoutEffect(() => {
    const input = textareaRef.current;
    const controls = controlsRef.current;
    const measure = measureRef.current;
    const modelButton = modelRef.current;
    if (!input || !controls || !measure || !modelButton) return;

    const fixedControlsWidth = 28 * 3 + modelButton.offsetWidth; // plus + 语音 + 发送 + 模型
    const inlineGaps = 4 * 4;
    const inlineInputWidth = controls.clientWidth - fixedControlsWidth - inlineGaps;
    const needsFullWidth = value.includes("\n") || measure.offsetWidth + 8 > inlineInputWidth;
    if (needsFullWidth !== expanded) {
      setExpanded(needsFullWidth);
    }

    input.style.height = "0px";
    const contentHeight = input.scrollHeight;
    input.style.height = `${Math.min(Math.max(contentHeight, 28), 100)}px`;
    input.style.overflowY = contentHeight > 100 ? "auto" : "hidden";
  }, [value, expanded]);

  /* 点击输入框外部关闭已打开的菜单 */
  React.useEffect(() => {
    if (!modelOpen && !plusOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-promptbar]")) {
        setModelOpen(false);
        setPlusOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [modelOpen, plusOpen]);

  const closeMenus = () => {
    setModelOpen(false);
    setPlusOpen(false);
  };

  const pick = (row: CommandItem) => {
    if (menu === "at") {
      setValue(`${token ? value.slice(0, token.start) : value}@${row.name} `);
    } else {
      setValue(`${token ? value.slice(0, token.start) : value}${row.name} `);
    }
    setDismissed(false);
    textareaRef.current?.focus();
  };

  const doSend = async () => {
    const text = value.trim();
    if (!text && attachments.length === 0) return;
    const images = attachments.length > 0 ? attachments : undefined;
    if (isStreaming) await steer(text, images);
    else await sendPrompt(text, { images });
    setValue("");
    setAttachments([]);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // 读取图片为 base64（Pi ImageContent 格式）
  const addImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: PiImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      next.push({ type: "image", data, mimeType: file.type });
    }
    if (next.length > 0) setAttachments((cur) => [...cur, ...next]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (menu && rows.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setEngaged(true);
        setActive((current) => (current + (e.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
        return;
      }
      if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
        e.preventDefault();
        pick(rows[active]);
        return;
      }
    }
    if (e.key === "Escape") {
      setDismissed(true);
      closeMenus();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      doSend();
    }
  };

  const canSend = value.trim().length > 0 || attachments.length > 0;
  const pendingCount = queue.steering.length + queue.followUp.length;

  return (
    <div data-promptbar className="mx-auto w-full max-w-3xl px-4 pb-4 pt-2">
      {/* composer 是锚点——菜单从它的顶边向上弹出 */}
      <div ref={composerAnchorRef} className="relative">
        {/* ── / 命令菜单 ─────────────────────────────── */}
        {menu && (
          <div
            onMouseLeave={() => setEngaged(false)}
            className="absolute inset-x-0 bottom-full z-10 mb-2 rounded-[10px] bg-surface p-1 shadow-raised"
            style={{ animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom center" }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
              style={{
                top: rowBox?.top ?? 0,
                height: rowBox?.height ?? 0,
                opacity: rowBox && engaged && rows.length > 0 ? 1 : 0,
                transition:
                  "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
              }}
            />
            {rows.map((row, i) => (
              <button
                key={row.key}
                type="button"
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => {
                  setActive(i);
                  setEngaged(true);
                }}
                onClick={() => pick(row)}
                className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-left"
              >
                <span className="flex size-[22px] shrink-0 items-center justify-center text-ink-2">
                  {menu === "at" ? <FileText size={15} /> : <ListChecks size={15} />}
                </span>
                <span className="shrink-0 text-[12.5px] font-medium text-ink">{row.name}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">{row.desc}</span>
              </button>
            ))}
            {rows.length === 0 && (
              <div className="flex h-9 items-center px-2 text-[12px] text-ink-3">没有匹配「{query}」</div>
            )}
            <div className="mt-1 border-t border-line px-2 pt-1.5 pb-1 text-[11px] text-ink-3">
              {menu === "at" ? "输入以搜索工作目录文件" : "输入以搜索命令"}
            </div>
          </div>
        )}

        {/* ── 模型菜单 ─────────────────────────────────── */}
        {modelOpen && (
          <div
            onMouseLeave={() => setModelHovered(null)}
            className="absolute z-10 w-44 rounded-[10px] bg-surface p-1 shadow-raised"
            style={{ left: modelMenuLeft, bottom: modelMenuBottom, animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom left" }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
              style={{
                top: modelBox?.top ?? 0,
                height: modelBox?.height ?? 0,
                opacity: modelBox && modelHovered !== null ? 1 : 0,
                transition:
                  "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
              }}
            />
            {modelItems.map((m, i) => (
              <button
                key={m.key}
                type="button"
                ref={(el) => {
                  modelRowRefs.current[i] = el;
                }}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setModelHovered(i)}
                onClick={() => {
                  setModel(m.provider, m.id);
                  setModelOpen(false);
                  textareaRef.current?.focus();
                }}
                className="relative z-10 flex h-[30px] w-full items-center gap-2 rounded-[6px] px-2 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{m.name}</span>
                {m.tag && <span className="shrink-0 text-[11px] text-ink-3">{m.tag}</span>}
                <span className={cn("shrink-0 text-ink", m.key === currentModelItem?.key ? "" : "invisible")}>
                  <Check size={13} strokeWidth={2.5} />
                </span>
              </button>
            ))}
            {modelItems.length === 0 && (
              <div className="flex h-[30px] items-center px-2 text-[12px] text-ink-3">暂无可用模型</div>
            )}
          </div>
        )}

        {/* ── 附件菜单（+ 按钮） ───────────────────────── */}
        {plusOpen && (
          <div
            className="absolute bottom-full left-0 z-10 mb-2 w-52 rounded-[10px] bg-surface p-1 shadow-raised"
            style={{ animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom left" }}
          >
            <div className="flex h-7 items-center px-2 text-[11px] font-medium text-ink-3">添加附件</div>
            <button
              type="button"
              onClick={() => {
                setPlusOpen(false);
                fileInputRef.current?.click();
              }}
              className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-left transition-colors duration-100 hover:bg-hover"
            >
              <span className="flex size-[22px] shrink-0 items-center justify-center text-ink-2">
                <ImageIcon size={15} />
              </span>
              <span className="text-[12.5px] font-medium text-ink">上传图片</span>
            </button>
            <button
              type="button"
              disabled
              className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-left opacity-60"
            >
              <span className="flex size-[22px] shrink-0 items-center justify-center text-ink-2">
                <FileText size={15} />
              </span>
              <span className="text-[12.5px] font-medium text-ink">上传文件</span>
              <span className="ml-auto text-[11px] text-ink-3">待接入</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void addImages(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {/* ── 输入框 ───────────────────────────────────── */}
        <div className="relative isolate flex flex-col gap-1.5 overflow-hidden rounded-[14px] border border-line bg-surface p-1.5 shadow-card transition-[border-color] duration-150 focus-within:border-line-strong">
          <span
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none absolute invisible whitespace-pre text-[13px] leading-[18px]"
          >
            {value}
          </span>

          {/* 附件预览 */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-0.5 pt-0.5">
              {attachments.map((img, i) => (
                <span
                  key={`${img.mimeType}-${i}`}
                  className="relative h-14 w-14 overflow-hidden rounded-[8px] border border-line bg-inset"
                >
                  <img
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label="移除图片"
                    onClick={() => setAttachments((cur) => cur.filter((_, j) => j !== i))}
                    className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-ink/70 text-surface transition-colors hover:bg-ink"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div
            ref={controlsRef}
            className={cn(
              "grid items-end gap-x-1 gap-y-1.5",
              wide
                ? "grid-cols-[28px_auto_minmax(0,1fr)_28px_28px]"
                : "grid-cols-[28px_minmax(0,1fr)_auto_28px_28px]",
            )}
          >
            {/* + 附件 */}
            <button
              type="button"
              aria-label="添加附件"
              aria-expanded={plusOpen}
              onClick={() => {
                setModelOpen(false);
                setPlusOpen((c) => !c);
                textareaRef.current?.focus();
              }}
              className={cn(
                "flex size-7 shrink-0 items-center justify-center justify-self-start rounded-[8px] text-ink-3 transition-[background-color,color,transform] duration-150 hover:bg-hover hover:text-ink active:scale-[0.94]",
                plusOpen && "bg-hover text-ink",
                wide ? "col-start-1 row-start-2" : "col-start-1 row-start-1",
              )}
            >
              <Plus size={16} strokeWidth={2} />
            </button>

            {/* 输入框 */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setDismissed(false);
                setPlusOpen(false);
              }}
              onKeyDown={onKeyDown}
              placeholder={isStreaming ? "向运行中的 Pi 发送 steering 消息…" : "给 Pi 发送消息，输入 / 用命令、@ 引用文件…"}
              aria-label="消息输入"
              className={cn(
                "min-h-7 min-w-0 w-full resize-none bg-transparent px-1 py-[5px] text-[13px] leading-[18px] text-ink outline-none [overflow-wrap:anywhere] placeholder:text-ink-3",
                wide ? "col-span-full col-start-1 row-start-1" : "col-start-2 row-start-1",
              )}
            />

            {/* 模型选择器 */}
            <button
              ref={modelRef}
              type="button"
              aria-expanded={modelOpen}
              aria-label="选择模型"
              onClick={() => {
                setPlusOpen(false);
                setModelOpen((c) => !c);
              }}
              className={cn(
                "flex h-7 shrink-0 items-center gap-1 rounded-[8px] px-1.5 text-[12px] font-medium text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink",
                wide ? "col-start-2 row-start-2 justify-self-start" : "col-start-3 row-start-1",
              )}
            >
              {currentModelItem?.name ?? "选择模型"}
              <span className="text-ink-3">
                <ChevronDown size={11} strokeWidth={2.4} />
              </span>
            </button>

            {/* 语音 / 后续消息 */}
            {isStreaming ? (
              <button
                type="button"
                onClick={() => followUp(value.trim() || "继续")}
                className={cn(
                  "flex h-7 shrink-0 items-center justify-center rounded-[8px] px-1.5 text-[12px] font-medium text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink",
                  wide ? "col-start-4 row-start-2" : "col-start-4 row-start-1",
                )}
              >
                后续
              </button>
            ) : (
              <button
                type="button"
                aria-label="语音输入（待接入）"
                title="语音输入（待接入）"
                disabled
                className={cn(
                  "flex size-7 shrink-0 cursor-not-allowed items-center justify-center rounded-[8px] text-ink-3 opacity-40",
                  wide ? "col-start-4 row-start-2" : "col-start-4 row-start-1",
                )}
              >
                <Mic size={15} strokeWidth={2} />
              </button>
            )}

            {/* 发送 / 停止 */}
            {isStreaming ? (
              <button
                type="button"
                aria-label="停止生成"
                onClick={abort}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-ink text-surface transition-transform duration-200 active:scale-[0.94]",
                  wide ? "col-start-5 row-start-2" : "col-start-5 row-start-1",
                )}
              >
                <Square size={14} className="fill-current" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="发送"
                disabled={!canSend}
                onClick={doSend}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-[8px] transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.94]",
                  wide ? "col-start-5 row-start-2" : "col-start-5 row-start-1",
                )}
                style={{
                  background: canSend ? "var(--ink)" : "var(--line-strong)",
                  color: canSend ? "var(--surface)" : "var(--ink-2)",
                }}
              >
                <ArrowUp size={16} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 flex items-center justify-center gap-2 text-center text-[11px] leading-4 text-ink-3">
        <span>Pi Agent 驱动 · 支持 / 命令 · Enter 发送，Shift+Enter 换行</span>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-500/10 px-1.5 py-px font-medium text-amber-600 dark:text-amber-400">
            队列 {pendingCount}
          </span>
        )}
      </p>
    </div>
  );
}
