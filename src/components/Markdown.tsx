import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (React.isValidElement(children)) {
    return extractText((children.props as { children?: React.ReactNode }).children);
  }
  return "";
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore clipboard errors in non-secure contexts
    }
  };

  return (
    <div className="group/code relative my-4 overflow-hidden rounded-window bg-ink text-page shadow-card">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2 text-xs text-ink-2">
        <span className="font-mono">{language || "text"}</span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className="font-mono text-[13px] text-page">{code}</code>
      </pre>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-[15px] leading-7">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: (props) => <>{props.children}</>,
          h1: (props) => (
            <h1
              className="mt-6 mb-3 text-xl font-semibold tracking-tight first:mt-0"
              {...props}
            />
          ),
          h2: (props) => (
            <h2
              className="mt-6 mb-2 text-lg font-semibold tracking-tight first:mt-0"
              {...props}
            />
          ),
          h3: (props) => (
            <h3
              className="mt-4 mb-2 text-base font-semibold tracking-tight first:mt-0"
              {...props}
            />
          ),
          p: (props) => (
            <p className="my-2 first:mt-0 last:mb-0" {...props} />
          ),
          ul: (props) => (
            <ul
              className="my-2 list-disc space-y-1 pl-6 marker:text-muted-foreground"
              {...props}
            />
          ),
          ol: (props) => (
            <ol
              className="my-2 list-decimal space-y-1 pl-6 marker:text-muted-foreground"
              {...props}
            />
          ),
          li: (props) => <li className="pl-1" {...props} />,
          blockquote: (props) => (
            <blockquote
              className="my-3 border-l-2 border-border pl-4 italic text-muted-foreground"
              {...props}
            />
          ),
          a: (props) => (
            <a
              className="font-medium text-blue-600 underline underline-offset-4 hover:text-blue-500 dark:text-blue-400"
              target="_blank"
              rel="noreferrer"
              {...props}
            />
          ),
          hr: () => <hr className="my-4 border-border" />,
          table: (props) => (
            <div className="my-4 overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-sm" {...props} />
            </div>
          ),
          th: (props) => (
            <th
              className="border-b bg-muted px-3 py-2 text-left font-semibold"
              {...props}
            />
          ),
          td: (props) => (
            <td
              className="border-b px-3 py-2 align-top last:border-r-0"
              {...props}
            />
          ),
          code: (props) => {
            const { children, className, ...rest } = props;
            const match = /language-([\w+-]+)/.exec(className || "");
            const text = extractText(children);
            const isBlock = Boolean(match) || text.includes("\n");
            if (isBlock) {
              return <CodeBlock language={match?.[1] ?? "text"} code={text} />;
            }
            return (
              <code
                className={cn(
                  "rounded-chip bg-field px-1.5 py-0.5 font-mono text-[13px] text-ink shadow-btn",
                  className
                )}
                {...rest}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
