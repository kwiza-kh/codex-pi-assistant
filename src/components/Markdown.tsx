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

/* ─────────────────────────────────────────────────────────
 * 轻量语法高亮：行级 tokenizer（关键字/字符串/数字/注释/函数名）
 * ───────────────────────────────────────────────────────── */

type CodeToken = { t: string; c?: "kw" | "str" | "num" | "fn" | "dim" };

const CODE_COLORS: Record<NonNullable<CodeToken["c"]>, string> = {
  kw: "var(--accent-ink)",
  str: "var(--green)",
  num: "var(--orange)",
  fn: "var(--ink)",
  dim: "var(--ink-3)",
};

const LANGUAGE_NAMES: Record<string, string> = {
  ts: "TypeScript", typescript: "TypeScript", tsx: "TSX",
  js: "JavaScript", javascript: "JavaScript", jsx: "JSX",
  py: "Python", python: "Python", rs: "Rust", rust: "Rust",
  go: "Go", rb: "Ruby", java: "Java", c: "C", cpp: "C++",
  cs: "C#", sh: "Shell", bash: "Bash", zsh: "Shell",
  json: "JSON", html: "HTML", css: "CSS", scss: "SCSS",
  sql: "SQL", md: "Markdown", yaml: "YAML", toml: "TOML",
  text: "text", txt: "text",
};

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
  "switch", "case", "break", "continue", "new", "class", "extends", "import", "export",
  "from", "default", "async", "await", "try", "catch", "finally", "throw", "typeof",
  "instanceof", "in", "of", "this", "super", "static", "get", "set", "yield", "delete",
  "void", "null", "undefined", "true", "false", "type", "interface", "implements", "enum",
  "public", "private", "protected", "readonly", "namespace", "declare", "abstract",
  "def", "None", "True", "False", "and", "or", "not", "pass", "elif", "lambda", "with",
  "as", "is", "raise", "global", "nonlocal", "assert", "fn", "mut", "pub", "struct",
  "impl", "match", "use", "mod", "crate", "self", "loop", "where", "trait", "dyn",
  "int", "float", "double", "char", "bool", "long", "short", "unsigned", "signed",
  "string", "void",
]);

function tokenizeLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let i = 0;
  const n = line.length;
  const isCodeChar = (c: string) => /[A-Za-z0-9_$]/.test(c) || c === '"' || c === "'" || c === "`";

  while (i < n) {
    const ch = line[i];
    const rest = line.slice(i);

    // 注释：// # 到行尾；/* */ 到闭合或行尾
    if (rest.startsWith("//") || rest.startsWith("#") || rest.startsWith("/*")) {
      let end = n;
      if (rest.startsWith("/*")) {
        const close = line.indexOf("*/", i + 2);
        if (close !== -1) end = close + 2;
      }
      tokens.push({ t: line.slice(i, end), c: "dim" });
      i = end;
      continue;
    }

    // 字符串（含转义）
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n) {
        if (line[j] === "\\") { j += 2; continue; }
        if (line[j] === ch) { j++; break; }
        j++;
      }
      tokens.push({ t: line.slice(i, j), c: "str" });
      i = j;
      continue;
    }

    // 数字
    if (/[0-9]/.test(ch)) {
      const m = /^[0-9][0-9a-zA-Z._]*/.exec(rest);
      tokens.push({ t: m![0], c: "num" });
      i += m![0].length;
      continue;
    }

    // 标识符：关键字 / 函数名（identifier 后紧跟 (）
    if (/[A-Za-z_$]/.test(ch)) {
      const m = /^[A-Za-z0-9_$]*/.exec(rest)!;
      const word = m[0];
      let j = i + word.length;
      while (j < n && line[j] === " ") j++;
      const isCall = j < n && line[j] === "(";
      tokens.push({ t: word, c: KEYWORDS.has(word) ? "kw" : isCall ? "fn" : undefined });
      i += word.length;
      continue;
    }

    // 标点/空白：合并连续
    let j = i;
    while (j < n) {
      if (isCodeChar(line[j])) break;
      const tail = line.slice(j);
      if (tail.startsWith("//") || tail.startsWith("#") || tail.startsWith("/*")) break;
      j++;
    }
    tokens.push({ t: line.slice(i, j), c: "dim" });
    i = j;
  }

  return tokens;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = React.useState(false);
  const lines = code.replace(/\n$/, "").split("\n");
  const langLabel = LANGUAGE_NAMES[language] || language || "text";

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors in non-secure contexts
    }
  };

  return (
    <div className="my-4 w-full overflow-hidden rounded-window bg-surface shadow-card">
      {/* header */}
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-mono text-[12px] font-medium text-ink">{langLabel}</span>
        <button
          type="button"
          aria-label="复制代码"
          onClick={onCopy}
          className={`flex h-6 items-center gap-1 rounded-[6px] px-1.5 text-[11.5px] font-medium transition-colors duration-100 hover:bg-hover ${copied ? "text-green" : "text-ink-3 hover:text-ink"}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>

      {/* code */}
      <pre className="scrollbar-thin overflow-x-auto bg-inset px-3 py-2.5 font-mono text-[11.5px] leading-[1.7]">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="w-6 shrink-0 select-none text-right text-[10.5px] leading-[1.86] text-ink-3">
              {i + 1}
            </span>
            <span className="whitespace-pre pl-3">
              {tokenizeLine(line).map((tok, j) => (
                <span key={j} style={{ color: tok.c ? CODE_COLORS[tok.c] : "var(--ink-2)" }}>
                  {tok.t}
                </span>
              ))}
            </span>
          </div>
        ))}
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
