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
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const stickToBottom = React.useRef(true);
  const prevMsgCount = React.useRef(0);

  // 用户手动滚动时，若滚离底部则暂停自动跟随
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  // 仅在「新增了一条消息」时自动滚到底部（而非每个流式 delta 都拉）
  React.useEffect(() => {
    const msgCount = messages.length;
    if (msgCount !== prevMsgCount.current) {
      prevMsgCount.current = msgCount;
      if (stickToBottom.current) {
        bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      }
    }
  }, [messages.length]);

  return (
    <div ref={scrollRef} onScroll={onScroll} className="scrollbar-thin flex-1 overflow-y-auto">
      {messages.length === 0 && !liveMessage ? (
        <EmptyState onPick={(prompt) => sendPrompt(prompt)} />
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
          {messages.map((m) => (
            <div key={m.id} id={`msg-${m.id}`} className="scroll-mt-20">
              <MessageBubble message={m} isLast={false} showTimestamp />
            </div>
          ))}

          {liveMessage && (
            <div className="animate-fade-in">
              <MessageBubble message={liveMessage} isLast showTimestamp={false} />
              {isStreaming && (
                <div className="mt-1">
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
