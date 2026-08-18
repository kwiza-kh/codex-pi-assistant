import * as React from "react";
import { Check, Eye, EyeOff, KeyRound, RefreshCw, Search, ServerCog, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import type { PiCatalogModel, PiProviderInfo } from "@/lib/pi-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function ProviderCard({ provider }: { provider: PiProviderInfo }) {
  const providerAuth = useChatStore((s) => s.providerAuth);
  const catalogModels = useChatStore((s) => s.catalogModels);
  const checkProviderAuth = useChatStore((s) => s.checkProviderAuth);
  const setProviderApiKey = useChatStore((s) => s.setProviderApiKey);
  const removeProviderApiKey = useChatStore((s) => s.removeProviderApiKey);

  const [showKey, setShowKey] = React.useState(false);
  const [key, setKey] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const auth = providerAuth[provider.id];
  const models = catalogModels.filter((m) => m.provider === provider.id);

  const onSave = async () => {
    if (!key.trim()) return;
    setSaving(true);
    await setProviderApiKey(provider.id, key.trim());
    setSaving(false);
    setKey("");
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ServerCog className="h-4 w-4 shrink-0 text-muted-foreground" />
              <h4 className="truncate text-sm font-semibold">{provider.name}</h4>
              <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{provider.id}</code>
            </div>
            {provider.baseUrl && (
              <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{provider.baseUrl}</div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {provider.apiKeyAuth && (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <KeyRound className="h-3 w-3" />
                  API Key
                </Badge>
              )}
              {provider.oauthAuth && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  OAuth{provider.oauthAuth.isSubscription ? " · 订阅" : ""}
                </Badge>
              )}
              {auth?.configured ? (
                <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" />
                  {auth.check?.source ?? "已配置"}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  未配置
                </Badge>
              )}
              <button
                type="button"
                onClick={() => checkProviderAuth(provider.id)}
                className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
              >
                检测
              </button>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 text-[11px] text-muted-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {models.length > 0 ? `${models.length} 个模型` : `${provider.modelCount} 个模型`}
          </Button>
        </div>

        {expanded && (
          <div className="mt-3 rounded-lg border bg-inset p-3">
            <div className="mb-2 text-[11px] font-medium text-muted-foreground">
              {provider.apiKeyAuth?.name ?? "API Key"}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={auth?.configured ? "输入新 Key 以替换" : "sk-..."}
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
                onClick={onSave}
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
                  <Trash2 className="h-3.5 w-3.5" />
                  移除
                </Button>
              )}
            </div>
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
              保存后会自动重启 Pi 进程使凭据生效；当前会话会切换到新会话。
            </p>

            {models.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">模型目录</div>
                <div className="scrollbar-thin max-h-48 space-y-1 overflow-y-auto">
                  {models.map((m) => (
                    <ModelRow key={`${m.provider}/${m.id}`} model={m} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ModelRow({ model }: { model: PiCatalogModel }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-field px-2 py-1.5 text-xs">
      <div className="min-w-0">
        <div className="truncate font-medium">{model.name}</div>
        <div className="truncate font-mono text-[10px] text-muted-foreground">
          {model.id} · {model.api}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
        {model.reasoning && <span className="rounded bg-violet-500/10 px-1 py-0.5 text-violet-500">R</span>}
        {model.contextWindow != null && (
          <span className="tabular-nums">{Math.round(model.contextWindow / 1000)}k ctx</span>
        )}
      </div>
    </div>
  );
}

export function ProvidersPanel() {
  const providers = useChatStore((s) => s.providers);
  const refreshProviders = useChatStore((s) => s.refreshProviders);
  const refreshCatalogModels = useChatStore((s) => s.refreshCatalogModels);
  const modelsRefreshing = useChatStore((s) => s.modelsRefreshing);
  const catalogModels = useChatStore((s) => s.catalogModels);
  const [query, setQuery] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  const lastError = useChatStore((s) => s.lastError);

  const load = React.useCallback(() => {
    refreshProviders();
    refreshCatalogModels();
  }, [refreshProviders, refreshCatalogModels]);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = providers.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
  });

  const visible = showAll ? filtered : filtered.slice(0, 20);
  const totalModels = catalogModels.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 Provider…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          onClick={load}
          disabled={modelsRefreshing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", modelsRefreshing && "animate-spin")} />
          刷新目录
        </Button>
      </div>

      {lastError && providers.length === 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-red-tint px-3 py-2 text-xs text-destructive">
          <span className="min-w-0 truncate">加载 Provider 失败：{lastError}</span>
          <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={load}>
            重试
          </Button>
        </div>
      )}

      <div className="text-[11px] text-muted-foreground">
        共 {providers.length} 个模型接入商 · 缓存模型目录 {totalModels} 个模型
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        {visible.map((p) => (
          <ProviderCard key={p.id} provider={p} />
        ))}
      </div>

      {filtered.length > visible.length && (
        <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => setShowAll(true)}>
          显示全部 {filtered.length} 个 Provider
        </Button>
      )}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          <X className="h-5 w-5" />
          未找到匹配的 Provider
        </div>
      )}
      <Separator />
      <p className="text-[11px] leading-5 text-muted-foreground">
        OAuth / 订阅型 Provider（如 Anthropic 订阅、OpenAI Codex、GitHub Copilot）请在终端运行
        <code className="mx-1 rounded bg-muted px-1 font-mono">pi /login</code> 完成浏览器授权；环境变量型 Provider
        （如 Amazon Bedrock）请设置对应的环境变量后重新连接。
      </p>
    </div>
  );
}
