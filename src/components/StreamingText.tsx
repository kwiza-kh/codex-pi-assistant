/* ─────────────────────────────────────────────────────────
 * STREAMING TEXT — 流式文本
 * 逐词从模糊中显形（stream-in），进行中显示光标；
 * 结束后可选的「追问建议」浮现。文本由调用方传入的
 * content 驱动（对应 Pi 的 text_delta 累积），不做本地
 * 假定时器切分。动作（复制/重试/赞/踩）由 MessageBubble
 * 已有的 hover 动作行负责，这里不再重复。
 * ───────────────────────────────────────────────────────── */

function tokenizeLines(text: string): string[][] {
  return text.split("\n").map((line) => line.split(" "));
}

export function StreamingText({
  content,
  streaming = false,
  followUps = [],
  onFollowUp,
}: {
  content: string;
  streaming?: boolean;
  followUps?: string[];
  onFollowUp?: (text: string) => void;
}) {
  const lines = tokenizeLines(content);
  const done = !streaming;

  return (
    <div className="w-full">
      <div className="text-[13px] leading-relaxed text-ink">
        {lines.map((words, li) => (
          <span key={li} className="block min-h-[1.25em]">
            {words.map((word, wi) => (
              <span
                key={wi}
                className="inline"
                style={{
                  animation: "stream-in 420ms cubic-bezier(0.22,0.61,0.25,1) both",
                  willChange: "filter, opacity",
                }}
              >
                {word}
                {wi < words.length - 1 ? " " : ""}
              </span>
            ))}
          </span>
        ))}
        {streaming && (
          <span
            className="ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 rounded-full bg-ink"
            style={{ animation: "fade-in 150ms ease-out both" }}
          />
        )}
      </div>

      {done && followUps.length > 0 && (
        <div className="mt-2.5 transition-opacity duration-[400ms]">
          <p className="text-[12px] font-medium text-ink-2">追问建议</p>
          <div className="mt-0.5 flex flex-col">
            {followUps.map((text, i) => (
              <button
                key={text}
                type="button"
                onClick={() => onFollowUp?.(text)}
                className="-mx-1.5 flex items-center gap-2 rounded-[7px] border-b border-line
                  px-1.5 py-1.5 text-left text-[12.5px] text-ink transition-colors
                  duration-100 hover:bg-hover-2"
                style={{ animation: `fade-up 350ms cubic-bezier(0.23,1,0.32,1) ${i * 90}ms both` }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M9 10l-5 5 5 5" />
                  <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                </svg>
                {text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
