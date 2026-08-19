import * as React from "react";
import { useChatStore } from "@/store/chat";
import { EmptyState } from "@/components/EmptyState";
import { ActiveToolsCard, MessageBubble } from "@/components/MessageBubble";
import { LoadingState } from "@/components/LoadingState";

export function ChatView() {
  const messages = useChatStore((s) => s.messages);
  const liveMessage = useChatStore((s) => s.liveMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sendPrompt = useChatStore((s) => s.sendPrompt);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const lastContent = liveMessage?.text ?? messages[messages.length - 1]?.text ?? "";

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastContent, liveMessage?.blocks.length]);

  const handleRegenerate = (assistantMessageId: string) => {
    const idx = messages.findIndex((m) => m.id === assistantMessageId);
    if (idx < 1) return;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        sendPrompt(messages[i].text);
        return;
      }
    }
  };

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      {messages.length === 0 && !liveMessage ? (
        <EmptyState onPick={(prompt) => sendPrompt(prompt)} />
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isLast={false}
              showTimestamp
              onRegenerate={m.role === "assistant" ? () => handleRegenerate(m.id) : undefined}
            />
          ))}

          {liveMessage && (
            <div className="animate-fade-in">
              <MessageBubble message={liveMessage} isLast showTimestamp={false} />
              {isStreaming && (
                <div className="ml-11 mt-1">
                  <LoadingState label="正在生成" />
                </div>
              )}
              <ActiveToolsCard />
            </div>
          )}

          <div ref={bottomRef} className="h-px" />
        </div>
      )}
    </div>
  );
}
