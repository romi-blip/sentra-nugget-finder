import { memo } from "react";
import { cn } from "@/lib/utils";

interface StreamingMessageProps {
  content: string;
  isStreaming: boolean;
}

export const StreamingMessage = memo(({ content, isStreaming }: StreamingMessageProps) => {
  return (
    <div className="relative">
      <span className="whitespace-pre-wrap break-words">{content}</span>
      {isStreaming && (
        <span className="inline-block w-[3px] h-4 ml-1 bg-primary animate-pulse align-middle" />
      )}
    </div>
  );
});

StreamingMessage.displayName = "StreamingMessage";
