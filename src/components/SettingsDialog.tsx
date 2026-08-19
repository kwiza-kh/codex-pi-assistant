import * as React from "react";
import { Boxes, RefreshCw, RotateCw, SlidersHorizontal, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import {
  getSettingValue,
  makeSettingsPatch,
  SETTINGS_TABS,
  type SettingField,
} from "@/lib/pi-settings-schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

/* ---------------------------------------------------------------------------
 * 统一样式常量
 * ------------------------------------------------------------------------- */

const CONTROL_SIZE = "h-8";
const TEXT_SIZE = "text-xs";
const CONTROL_BOX = "w-full rounded-md border bg-transparent";

function ControlShell({ children }: { children: React.ReactNode }) {
  return <div className="w-full sm:w-[280px] sm:justify-self-end">{children}</div>;
}

function SettingRow({
  title,
  description,
  children,
  restartRequired,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  restartRequired?: boolean;
}) {
  return (
    <div className="grid gap-x-6 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_280px] sm:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium leading-5">
          {title}
          {restartRequired && (
            <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-normal leading-4 text-amber-600 dark:text-amber-400">
              重启生效
            </span>
          )}
        </div>
        {description && <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>}
      </div>
      <ControlShell>{children}</ControlShell>
    </div>
  );
}

function StringField({ field, value, onSave }: { field: SettingField; value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  return (
    <Input
      value={draft}
      placeholder={field.placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={cn(CONTROL_SIZE, TEXT_SIZE, CONTROL_BOX)}
    />
  );
}

function NumberField({ field, value, onSave }: { field: SettingField; value: number | undefined; onSave: (v: number | undefined) => void }) {
  const [draft, setDraft] = React.useState(value?.toString() ?? "");
  React.useEffect(() => setDraft(value?.toString() ?? ""), [value]);
  return (
    <Input
      type="number"
      value={draft}
      min={field.min}
      max={field.max}
      step={field.step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === "") {
          if (value !== undefined) onSave(undefined);
          return;
        }
        const n = Number(draft);
        if (!Number.isNaN(n) && n !== value) onSave(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={cn(CONTROL_SIZE, TEXT_SIZE, CONTROL_BOX, "tabular-nums")}
    />
  );
}

function SelectField({ field, value, onSave }: { field: SettingField; value: string; onSave: (v: string) => void }) {
  return (
    <div className="flex w-full flex-wrap gap-1 rounded-md border bg-inset p-1">
      {(field.options ?? []).map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onSave(opt)}
            className={cn(
              "h-7 flex-1 whitespace-nowrap rounded-[5px] px-2.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function BooleanField({ value, onSave }: { value: boolean; onSave: (v: boolean) => void }) {
  return (
    <div className={cn("flex items-center justify-end", CONTROL_SIZE)}>
      <Switch checked={Boolean(value)} onCheckedChange={(v) => onSave(v)} />
    </div>
  );
}

function JsonField({ field, value, onSave }: { field: SettingField; value: unknown; onSave: (v: unknown) => void }) {
  const [draft, setDraft] = React.useState(JSON.stringify(value ?? field.defaultValue ?? null, null, 2));
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setDraft(JSON.stringify(value ?? field.defaultValue ?? null, null, 2));
  }, [value, field.defaultValue]);

  return (
    <div className="w-full">
      <Textarea
        rows={3}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          try {
            JSON.parse(e.target.value);
            setError(null);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
        onBlur={() => {
          if (error) return;
          try {
            const parsed = JSON.parse(draft);
            onSave(parsed);
          } catch {
            /* ignore */
          }
        }}
        className="min-h-[68px] resize-none rounded-md border bg-transparent font-mono text-[11px] leading-5"
      />
      {error && <p className="mt-1 text-[10px] text-destructive">JSON 无效：{error}</p>}
    </div>
  );
}

function FieldControl({ field, value, onSave }: { field: SettingField; value: unknown; onSave: (v: unknown) => void }) {
  if (field.type === "boolean") {
    return <BooleanField value={Boolean(value)} onSave={(v) => onSave(v)} />;
  }
  if (field.type === "select") {
    return <SelectField field={field} value={String(value ?? field.defaultValue ?? "")} onSave={onSave} />;
  }
  if (field.type === "number") {
    return <NumberField field={field} value={typeof value === "number" ? value : undefined} onSave={onSave} />;
  }
  if (field.type === "json") {
    return <JsonField field={field} value={value} onSave={onSave} />;
  }
  return <StringField field={field} value={String(value ?? "")} onSave={onSave} />;
}

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

function ModeSelector({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: readonly string[];
  onSelect: (v: string) => void | Promise<void>;
}) {
  return (
    <div className="flex w-full rounded-md border bg-inset p-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onSelect(opt)}
          className={cn(
            "h-7 flex-1 rounded-[5px] px-2 text-xs font-medium transition-colors",
            value === opt
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 设置弹窗
 * ------------------------------------------------------------------------- */

export function SettingsDialog() {
  const open = useChatStore((s) => s.isSettingsOpen);
  const setOpen = useChatStore((s) => s.setSettingsOpen);
  const setModelDialogOpen = useChatStore((s) => s.setModelDialogOpen);
  const model = useChatStore((s) => s.model);
  const thinkingLevel = useChatStore((s) => s.thinkingLevel);
  const availableThinkingLevels = useChatStore((s) => s.availableThinkingLevels);
  const setThinkingLevel = useChatStore((s) => s.setThinkingLevel);
  const cycleThinkingLevel = useChatStore((s) => s.cycleThinkingLevel);
  const autoCompactionEnabled = useChatStore((s) => s.autoCompactionEnabled);
  const setAutoCompaction = useChatStore((s) => s.setAutoCompaction);
  const steeringMode = useChatStore((s) => s.steeringMode);
  const followUpMode = useChatStore((s) => s.followUpMode);
  const setSteeringMode = useChatStore((s) => s.setSteeringMode);
  const setFollowUpMode = useChatStore((s) => s.setFollowUpMode);
  const sessionName = useChatStore((s) => s.sessionName);
  const setSessionName = useChatStore((s) => s.setSessionName);
  const cwd = useChatStore((s) => s.cwd);
  const setWorkingDir = useChatStore((s) => s.setWorkingDir);
  const stats = useChatStore((s) => s.stats);
  const refreshAll = useChatStore((s) => s.refreshAll);
  const refreshSettings = useChatStore((s) => s.refreshSettings);
  const settings = useChatStore((s) => s.settings);
  const settingsPath = useChatStore((s) => s.settingsPath);
  const saveSettings = useChatStore((s) => s.saveSettings);
  const restartPi = useChatStore((s) => s.restartPi);

  const [nameDraft, setNameDraft] = React.useState("");
  const [cwdDraft, setCwdDraft] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setNameDraft(sessionName ?? "");
      setCwdDraft(cwd ?? "");
      refreshSettings();
    }
  }, [open, sessionName, cwd, refreshSettings]);

  const onSaveField = (key: string, value: unknown) => {
    saveSettings(makeSettingsPatch(key, value));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4 pr-12">
          <DialogTitle className="text-base">Pi Agent 设置</DialogTitle>
          <DialogDescription className="mt-1 flex flex-col gap-1">
            <span className="inline-flex items-center gap-2">
              配置文件：
              <code className="max-w-[420px] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                {settingsPath ?? "—"}
              </code>
            </span>
            <span>运行参数通过 RPC 即时生效，持久化参数保存后写入配置文件。</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <Tabs defaultValue="runtime" className="flex min-h-0 flex-1 flex-col">
            <div className="border-b px-4 py-2">
              <TabsList className="scrollbar-thin h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-md bg-muted p-1">
                <TabsTrigger value="runtime" className="h-7 shrink-0 px-3 text-xs">
                  <TerminalSquare className="mr-1.5 h-3.5 w-3.5" />
                  运行
                </TabsTrigger>
                {SETTINGS_TABS.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id} className="h-7 shrink-0 px-3 text-xs">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {/* 运行态 */}
              <TabsContent value="runtime" className="mt-0 space-y-0">
                <SettingRow title="当前模型" description={model ? `${model.provider}/${model.id}` : "未选择"}>
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => refreshAll()}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      刷新
                    </Button>
                  </div>
                </SettingRow>
                <Separator />

                <SettingRow title="模型与接入商" description="浏览全部 Provider 与模型目录，配置 API Key 并切换当前模型">
                  <div className="flex items-center justify-end">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setModelDialogOpen(true)}>
                      <Boxes className="h-3.5 w-3.5" />
                      打开管理
                    </Button>
                  </div>
                </SettingRow>
                <Separator />

                <SettingRow title="思考等级" description="对支持 reasoning 的模型即时生效">
                  <div className="flex w-full items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <ModeSelector
                        value={thinkingLevel}
                        options={availableThinkingLevels.length > 0 ? availableThinkingLevels : THINKING_LEVELS}
                        onSelect={setThinkingLevel}
                      />
                    </div>
                    <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => cycleThinkingLevel()} aria-label="循环切换思考等级">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </SettingRow>
                <Separator />

                <SettingRow title="自动压缩上下文" description="运行时开关，持久化见「压缩重试」标签">
                  <BooleanField value={autoCompactionEnabled} onSave={setAutoCompaction} />
                </SettingRow>
                <Separator />

                <SettingRow title="Steering 模式" description="streaming 中 steering 消息的投递方式">
                  <ModeSelector value={steeringMode} options={["all", "one-at-a-time"]} onSelect={(v) => setSteeringMode(v as "all" | "one-at-a-time")} />
                </SettingRow>
                <Separator />

                <SettingRow title="Follow-up 模式" description="streaming 中 follow_up 消息的投递方式">
                  <ModeSelector value={followUpMode} options={["all", "one-at-a-time"]} onSelect={(v) => setFollowUpMode(v as "all" | "one-at-a-time")} />
                </SettingRow>
                <Separator />

                <SettingRow title="会话名称">
                  <div className="flex w-full items-center gap-2">
                    <Input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      className="h-8 min-w-0 flex-1 text-xs"
                    />
                    <Button
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => setSessionName(nameDraft.trim())}
                      disabled={!nameDraft.trim() || nameDraft.trim() === sessionName}
                    >
                      保存
                    </Button>
                  </div>
                </SettingRow>
                <Separator />

                <SettingRow title="工作目录" description="切换后重启 Pi，使用该目录作为 read/bash/edit/write 根目录">
                  <div className="flex w-full items-center gap-2">
                    <Input
                      value={cwdDraft}
                      onChange={(e) => setCwdDraft(e.target.value)}
                      className="h-8 min-w-0 flex-1 font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0"
                      onClick={() => setWorkingDir(cwdDraft.trim())}
                      disabled={!cwdDraft.trim() || cwdDraft.trim() === cwd}
                    >
                      切换
                    </Button>
                  </div>
                </SettingRow>
                <Separator />

                <SettingRow title="重启 Pi" description="持久化设置修改后，重启 RPC 子进程使其生效">
                  <div className="flex items-center justify-end">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => restartPi()}>
                      <RotateCw className="h-3.5 w-3.5" />
                      重启
                    </Button>
                  </div>
                </SettingRow>
                <Separator />

                <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-4">
                  {[
                    { label: "会话消息", value: stats?.totalMessages ?? "—" },
                    { label: "工具调用", value: stats?.toolCalls ?? "—" },
                    {
                      label: "上下文",
                      value: stats?.contextUsage ? `${stats.contextUsage.percent ?? 0}%` : "—",
                    },
                    {
                      label: "预估成本",
                      value: stats?.cost != null ? `$${Number(stats.cost).toFixed(4)}` : "—",
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border bg-inset px-3 py-2.5">
                      <div className="text-[11px] text-muted-foreground">{item.label}</div>
                      <div className="mt-0.5 truncate text-base font-semibold tabular-nums">{item.value}</div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* 持久化设置 */}
              {SETTINGS_TABS.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="mt-0">
                  {tab.sections.map((section) => (
                    <div key={section.title} className="mb-4">
                      <h4 className="flex items-center gap-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        {section.title}
                      </h4>
                      <div className="space-y-0">
                        {section.fields.map((field) => {
                          const value = getSettingValue(settings, field.key, field.defaultValue);
                          return (
                            <React.Fragment key={field.key}>
                              <SettingRow
                                title={field.label}
                                description={field.desc}
                                restartRequired={field.restartRequired}
                              >
                                <FieldControl field={field} value={value} onSave={(v) => onSaveField(field.key, v)} />
                              </SettingRow>
                              <Separator />
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
