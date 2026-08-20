import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import java from "highlight.js/lib/languages/java";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import ini from "highlight.js/lib/languages/ini";
import diff from "highlight.js/lib/languages/diff";
import plaintext from "highlight.js/lib/languages/plaintext";

/* ─────────────────────────────────────────────────────────
 * 代码高亮 — highlight.js 按需注册（token 级精确）
 * 整体高亮后按行拆分，正确处理跨行注释/字符串。
 * ───────────────────────────────────────────────────────── */

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("java", java);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("php", php);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("plaintext", plaintext);

const LANG_ALIASES: Record<string, string> = {
  ts: "typescript", tsx: "typescript", typescript: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript", javascript: "javascript",
  py: "python", python: "python",
  rs: "rust", rust: "rust",
  go: "go", golang: "go",
  sh: "bash", bash: "bash", shell: "bash", zsh: "bash", ksh: "bash",
  json: "json",
  html: "xml", htm: "xml", xml: "xml", svg: "xml",
  css: "css", scss: "css", less: "css",
  sql: "sql",
  yaml: "yaml", yml: "yaml",
  md: "markdown", markdown: "markdown",
  java: "java",
  c: "c", h: "c",
  cpp: "cpp", cc: "cpp", cxx: "cpp", "c++": "cpp", hpp: "cpp",
  cs: "csharp", csharp: "csharp", "c#": "csharp",
  rb: "ruby", ruby: "ruby",
  php: "php",
  dockerfile: "dockerfile", docker: "dockerfile",
  toml: "ini", ini: "ini", conf: "ini", cfg: "ini",
  diff: "diff", patch: "diff",
  txt: "plaintext", text: "plaintext", plaintext: "plaintext",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 把 highlight.js 输出的整段 HTML 按换行拆成"每行都是自闭合"的行数组。
 * 跨行的 span（块注释、多行字符串等）在行边界处闭合、下一行重新打开，
 * 从而既能逐行渲染行号，又保持 token 着色不跨行断裂。
 */
function splitHighlightedHtml(html: string): string[] {
  const lines: string[] = [];
  const openTags: string[] = [];
  let current = "";

  const tokens = html.split(/(<span[^>]*>|<\/span>|\n)/g).filter(Boolean);

  for (const tok of tokens) {
    if (tok === "\n") {
      lines.push(current + "</span>".repeat(openTags.length));
      current = openTags.join("");
    } else if (tok.startsWith("<span")) {
      openTags.push(tok);
      current += tok;
    } else if (tok === "</span>") {
      openTags.pop();
      current += tok;
    } else {
      current += tok;
    }
  }

  if (current) {
    lines.push(current + "</span>".repeat(openTags.length));
  }
  return lines;
}

/** 将 markdown 代码块语言标签规范化为 highlight.js 语言名 */
export function normalizeLanguage(lang: string): string {
  const key = (lang || "").trim().toLowerCase();
  return LANG_ALIASES[key] ?? key;
}

/** 高亮整段代码，返回逐行 HTML（每行 token 级着色、自闭合） */
export function highlightLines(code: string, language: string): string[] {
  const normalized = normalizeLanguage(language);
  const lang = hljs.getLanguage(normalized) ? normalized : "plaintext";

  let html: string;
  try {
    html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(code).split("\n");
  }
  return splitHighlightedHtml(html);
}
