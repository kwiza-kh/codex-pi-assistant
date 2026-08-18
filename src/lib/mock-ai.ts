import { invoke } from "@tauri-apps/api/core";

export interface ReplyContext {
  prompt: string;
  model: string;
  signal?: AbortSignal;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * 获取一段完整回复文本。
 * 在 Tauri 桌面端优先调用 Rust 后端命令，Web 端回退到本地 Mock 引擎。
 */
export async function fetchFullReply(ctx: ReplyContext): Promise<string> {
  if (isTauri()) {
    try {
      return await invoke<string>("ai_chat", { prompt: ctx.prompt, model: ctx.model });
    } catch (err) {
      console.warn("Tauri ai_chat 调用失败，回退到本地 Mock：", err);
    }
  }
  return mockReply(ctx.prompt, ctx.model);
}

/**
 * 以流式方式逐段产出回复文本。
 */
export async function* streamReply(ctx: ReplyContext): AsyncGenerator<string> {
  const full = await fetchFullReply(ctx);
  const signal = ctx.signal;

  // 按可读块切分，模拟真实 token 流
  const chunks = splitIntoChunks(full, 4 + Math.floor(Math.random() * 6));
  for (const chunk of chunks) {
    if (signal?.aborted) {
      throw new DOMException("已中止", "AbortError");
    }
    yield chunk;
    await sleep(18 + Math.random() * 22);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitIntoChunks(text: string, size: number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    out.push(text.slice(i, i + size));
    i += size;
  }
  return out;
}

function mockReply(prompt: string, model: string): string {
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) {
    return "我在这里，随时可以开始。你可以让我解释概念、编写代码、润色文案，或者帮你梳理思路。";
  }

  if (/(代码|code|函数|function|组件|component|实现|react|rust|python|tauri|bug|报错|错误)/.test(lower)) {
    return `好的，针对 \u201c${excerpt(trimmed, 36)}\u201d，下面给出一个清晰的技术方案。

## 思路

1. **先明确输入与输出**：把需求拆成可验证的最小单元。
2. **选择合适的数据结构**：优先使用语言内置类型，保持简单。
3. **分层实现**：核心逻辑、接口层、UI 层分离，便于测试与维护。
4. **异常处理**：对网络、文件、非法输入做防御式处理。

## 示例代码

\`\`\`ts
export function createSlug(text: string, maxLen = 40): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\\p{L}\\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);

  return slug || "untitled";
}
\`\`\`

## 关键点

- 使用 \`Intl.Segmenter\` 或正则时注意 Unicode 边界。
- 若涉及 IO，记得处理超时与重试。
- 建议补上单元测试覆盖核心分支。

需要我继续展开某一部分，或者结合你的真实项目结构调整吗？`;
  }

  if (/(解释|是什么|为什么|原理|概念|区别|介绍|how|what|why)/.test(lower)) {
    return `这是一个很好的问题。

## 简要回答

\`${excerpt(trimmed, 30)}\` 的核心在于**抽象与权衡**：它把复杂问题拆解成可理解、可复用的最小单元。

## 展开说明

- **直觉理解**：可以把它类比成日常生活中的“模板”，固定不变的部分被封装，变化的部分暴露为参数。
- **为什么重要**：减少重复、降低耦合、让系统更容易演进。
- **常见误区**：过早抽象可能比重复代码更有害，应当等到模式稳定后再进行提炼。

## 小结

理解它的最好方式，是动手实现一个最小版本，然后观察哪些地方开始“痛”，再针对性地引入抽象。

如果你想，我可以给你列一个 5 分钟即可完成的小实验。`;
  }

  if (/(润色|改写|翻译|文案|写邮件|周报|总结|summary|polish)/.test(lower)) {
    return `## 润色版本

${trimmed
  .split(/[\n。]/)
  .filter(Boolean)
  .slice(0, 3)
  .map((s, i) => `${i + 1}. ${s.trim()} —— 表达更精炼，语势更自然。`)
  .join("\n")}

## 改写思路

- 保留原意，删除冗余修饰；
- 统一主语，避免被动语态滥用；
- 增加连接词，让逻辑更顺畅。

如果你有目标读者（比如客户、领导、开发者社区），告诉我，我可以进一步调整语气。`;
  }

  return `收到。关于 \u201c${excerpt(trimmed, 40)}\u201d，我从几个角度帮你梳理一下：

## 1. 背景与现状
先明确目标：你希望达到什么结果？是决策、学习、还是产出内容？

## 2. 可选路径
- **路径 A**：快速验证 —— 用最小成本跑通闭环；
- **路径 B**：稳健推进 —— 补齐边界条件后再扩展；
- **路径 C**：深度优化 —— 在已有基础上做精细化打磨。

## 3. 我的建议
如果你当前时间有限，优先选择路径 A；如果质量要求高，建议直接走路径 B，并在关键节点设置检查点。

可以再补充一些上下文（目标、限制、时间），我会给出更具体的建议。当前使用模型：\`${model}\`。`;
}

function excerpt(text: string, max = 40): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}
