import * as React from "react";

/* ─────────────────────────────────────────────────────────
 * MERMAID — mermaid 图表渲染
 * 按需动态加载 mermaid（体积较大，避免首屏打包），
 * 在暗色/亮色主题下使用对应主题，渲染失败回退为纯文本。
 * ───────────────────────────────────────────────────────── */

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => m.default);
  }
  return mermaidPromise;
}

export function Mermaid({ code }: { code: string }) {
  const [svg, setSvg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const idRef = React.useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await loadMermaid();
        const dark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? "dark" : "default",
          securityLevel: "strict",
          fontFamily: '"Inter", -apple-system, "Segoe UI", sans-serif',
        });
        const { svg: rendered } = await mermaid.render(idRef.current, code);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <pre className="overflow-auto whitespace-pre-wrap break-all rounded-md bg-red-tint px-3 py-2 font-mono text-[11px] leading-5 text-red">
        {code}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="flex items-center justify-center rounded-md bg-inset px-3 py-6 text-[12px] text-ink-3">
        渲染图表中…
      </div>
    );
  }

  return (
    <div
      className="my-4 flex w-full justify-center overflow-x-auto rounded-window bg-surface px-3 py-3 shadow-card"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
