import * as React from "react";
import {
  Boxes,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Search,
  ServerCog,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import type { PiCatalogModel, PiProviderInfo } from "@/lib/pi-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

function formatCost(cost: { input: number; output: number } | null): string {
  if (!cost) return "—";
  return `$${cost.input.toFixed(2)} / $${cost.output.toFixed(2)}`;
}

function ProviderRow({
  provider,
  selected,
  onSelect,
}: {
  provider: PiProviderInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  const auth = useChatStore((s) => s.providerAuth[provider.id]);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
        selected ? "bg-accent" : "hover:bg-hover"
      )}
    >
      <ServerCog className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", selected ? "text-foreground" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cn("truncate text-[13px] font-medium", selected ? "text-foreground" : "text-ink")}>
            {provider.name}
          </span>
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              auth?.configured ? "bg-emerald-500" : "bg-neutral-400/50"
            )}
            title={auth?.configured ? "已配置" : "未配置"}
          />
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <code className="truncate">{provider.id}</code>
          <span>·</span>
          <span>{provider.modelCount} 模型</span>
        </span>
      </span>
    </button>
  );
}

function ApiKeyEditor({ provider }: { provider: PiProviderInfo }) {
  const auth = useChatStore((s) => s.providerAuth[provider.id]);
  const setProviderApiKey = useChatStore((s) => s.setProviderApiKey);
  const removeProviderApiKey = useChatStore((s) => s.removeProviderApiKey);
  const [showKey, setShowKey] = React.useState(false);
  const [key, setKey] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  if (!provider.apiKeyAuth) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Input
          type={showKey ? "text" : "password"}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={auth?.configured ? "输入新 Key 以替换" : `${provider.apiKeyAuth.name}`}
          className="h-8 pr-9 text-xs"
        />
        <button
          type="button"
          onClick={() => setShowKey((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={showKey ? "隐藏" : "显示"}
        >
          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      <Button
        size="sm"
        className="h-8 shrink-0"
        disabled={!key.trim() || saving}
        onClick={async () => {
          setSaving(true);
          await setProviderApiKey(provider.id, key.trim());
          setSaving(false);
          setKey("");
        }}
      >
        {saving ? "保存中…" : "保存"}
      </Button>
      {auth?.configured && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0 text-destructive hover:text-destructive"
          onClick={() => removeProviderApiKey(provider.id)}
        >
          移除
        </Button>
      )}
    </div>
  );
}

function ModelRow({ model, currentProvider, currentModelId }: { model: PiCatalogModel; currentProvider?: string; currentModelId?: string }) {
  const setModel = useChatStore((s) => s.setModel);
  const [busy, setBusy] = React.useState(false);
  const active = model.provider === currentProvider && model.id === currentModelId;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        active ? "bg-accent-tint shadow-btn" : "bg-surface hover:bg-hover"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium">{model.name}</span>
          {active && (
            <Badge className="gap-1 bg-primary text-primary-foreground">
              <Check className="h-3 w-3" />
              当前
            </Badge>
          )}
          {model.reasoning && (
            <Badge variant="outline" className="gap-1 text-[10px] text-violet-500">
              <Zap className="h-3 w-3" />
              R
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
          <span>{model.id}</span>
          <span>·</span>
          <span>{model.api}</span>
          {model.contextWindow != null && (
            <>
              <span>·</span>
              <span className="tabular-nums">{Math.round(model.contextWindow / 1000)}k ctx</span>
            </>
          )}
          <span>·</span>
          <span className="tabular-nums">in/out {formatCost(model.cost)}</span>
        </div>
      </div>
      <Button
        size="sm"
        variant={active ? "secondary" : "outline"}
        className="h-8 shrink-0"
        disabled={active || busy}
        onClick={async () => {
          setBusy(true);
          await setModel(model.provider, model.id);
          setBusy(false);
        }}
      >
        {active ? "使用中" : "使用"}
      </Button>
    </div>
  );
}

export function ModelProviderDialog() {
  const open = useChatStore((s) => s.isModelDialogOpen);
  const setOpen = useChatStore((s) => s.setModelDialogOpen);
  const providers = useChatStore((s) => s.providers);
  const catalogModels = useChatStore((s) => s.catalogModels);
  const providerAuth = useChatStore((s) => s.providerAuth);
  const model = useChatStore((s) => s.model);
  const modelsRefreshing = useChatStore((s) => s.modelsRefreshing);
  const refreshProviders = useChatStore((s) => s.refreshProviders);
  const refreshCatalogModels = useChatStore((s) => s.refreshCatalogModels);
  const checkProviderAuth = useChatStore((s) => s.checkProviderAuth);
  const [providerQuery, setProviderQuery] = React.useState("");
  const [modelQuery, setModelQuery] = React.useState("");
  const [selectedProvider, setSelectedProvider] = React.useState<string>("");

  const load = React.useCallback(() => {
    refreshProviders();
    refreshCatalogModels();
  }, [refreshProviders, refreshCatalogModels]);

  React.useEffect(() => {
    if (open) {
      load();
      setSelectedProvider("");
      setProviderQuery("");
      setModelQuery("");
    }
  }, [open, load]);

  const filteredProviders = providers.filter((p) => {
    const q = providerQuery.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
  });

  const selected = providers.find((p) => p.id === selectedProvider) ?? null;
  const auth = selected ? providerAuth[selected.id] : undefined;

  const filteredModels = catalogModels.filter((m) => {
    if (selectedProvider && m.provider !== selectedProvider) return false;
    const q = modelQuery.trim().toLowerCase();
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q);
  });

  const visibleModels = filteredModels.slice(0, 200);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[88vh] max-h-[88vh] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader className="flex flex-row items-start justify-between border-b px-6 py-4 pr-12">
          <div className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Boxes className="h-5 w-5" />
              模型与接入商
            </DialogTitle>
            <DialogDescription>
              共 {providers.length} 个接入商 · 模型目录 {catalogModels.length} 个模型
            </DialogDescription>
          </div>
          <Button size="sm" variant="outline" className="h-8" onClick={load} disabled={modelsRefreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", modelsRefreshing && "animate-spin")} />
            刷新目录
          </Button>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          {/* 左侧 Provider 列表 */}
          <div className="flex w-[320px] shrink-0 flex-col border-r border-dashed border-line">
            <div className="border-b border-dashed border-line p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={providerQuery}
                  onChange={(e) => setProviderQuery(e.target.value)}
                  placeholder="搜索接入商…"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
              <button
                type="button"
                onClick={() => setSelectedProvider("")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                  selectedProvider === "" ? "bg-accent" : "hover:bg-hover"
                )}
              >
                <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
                全部模型
                <span className="ml-auto text-[11px] text-muted-foreground">{catalogModels.length}</span>
              </button>
              <Separator className="my-1.5" />
              {filteredProviders.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-xs text-muted-foreground">
                  <X className="h-4 w-4" />
                  未找到接入商
                </div>
              ) : (
                filteredProviders.map((p) => (
                  <ProviderRow
                    key={p.id}
                    provider={p}
                    selected={selectedProvider === p.id}
                    onSelect={() => setSelectedProvider(p.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* 右侧模型目录 */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* 选中 Provider 信息 + API Key */}
            <div className="border-b border-dashed border-line p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{selected ? selected.name : "全部模型"}</h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    {selected ? (
                      <>
                        <code className="rounded bg-muted px-1 py-0.5">{selected.id}</code>
                        {selected.baseUrl && <span className="truncate font-mono">{selected.baseUrl}</span>}
                        {selected.apiKeyAuth && (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <KeyRound className="h-3 w-3" />
                            API Key
                          </Badge>
                        )}
                        {selected.oauthAuth && (
                          <Badge variant="secondary" className="text-[10px]">
                            OAuth{selected.oauthAuth.isSubscription ? " · 订阅" : ""}
                          </Badge>
                        )}
                        {auth?.configured ? (
                          <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" />
                            已配置
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            未配置
                          </Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => selected && checkProviderAuth(selected.id)}
                          className="underline-offset-2 hover:underline"
                        >
                          检测
                        </button>
                      </>
                    ) : (
                      <span>浏览所有接入商的模型目录，选择模型后点击「使用」切换当前模型</span>
                    )}
                  </div>
                </div>
                {selected && selected.apiKeyAuth && <ApiKeyEditor provider={selected} />}
              </div>
              {selected && !selected.apiKeyAuth && selected.oauthAuth && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  该接入商使用 OAuth / 订阅授权，请在终端运行 <code className="rounded bg-muted px-1 font-mono">pi /login</code> 完成授权。
                </p>
              )}
            </div>

            <div className="border-b border-dashed border-line p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={modelQuery}
                  onChange={(e) => setModelQuery(e.target.value)}
                  placeholder="搜索模型名称 / ID / Provider…"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {visibleModels.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
                  <X className="h-5 w-5" />
                  暂无模型，点击右上角「刷新目录」拉取 pi.dev 模型目录
                </div>
              ) : (
                visibleModels.map((m) => (
                  <ModelRow
                    key={`${m.provider}/${m.id}`}
                    model={m}
                    currentProvider={model?.provider}
                    currentModelId={model?.id}
                  />
                ))
              )}
              {filteredModels.length > visibleModels.length && (
                <div className="pt-1 text-center text-[11px] text-muted-foreground">
                  仅显示前 200 个模型，使用搜索缩小范围（共 {filteredModels.length} 个匹配）
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
