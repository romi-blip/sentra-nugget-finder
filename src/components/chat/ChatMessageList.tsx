import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy, RotateCcw } from "lucide-react";
import { Message } from "@/types/chatSession";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface ChatMessageListProps {
  messages: Message[];
  onRegenerateMessage?: (messageId: string) => void;
}

export const ChatMessageList = ({ messages, onRegenerateMessage }: ChatMessageListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard" });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <ScrollArea className="flex-1">
      <div ref={scrollRef} className="p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`group relative rounded-lg px-4 py-3 max-w-[80%] ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border shadow-sm"
              }`}
            >
              {message.role === "assistant" ? (
                <div className="text-sm prose prose-sm max-w-none dark:prose-invert prose-a:text-primary prose-a:underline hover:prose-a:text-primary/80">
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline hover:text-primary/80 transition-colors"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap">
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline hover:text-primary/80 transition-colors"
                        >
                          {children}
                        </a>
                      ),
                      p: ({ children }) => <span>{children}</span>,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}

              {/* Message actions */}
              <div className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1 bg-background border rounded-md shadow-md p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(message.content)}
                    className="h-6 w-6"
                    title="Copy message"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  {message.role === "assistant" && onRegenerateMessage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRegenerateMessage(message.id)}
                      className="h-6 w-6"
                      title="Regenerate response"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Timestamp */}
              <div className="text-xs opacity-60 mt-2">
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};