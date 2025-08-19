import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Copy, RotateCcw } from "lucide-react";
import { Message } from "@/types/chatSession";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageListProps {
  messages: Message[];
  onRegenerateMessage?: (messageId: string) => void;
}

export const ChatMessageList = ({ messages, onRegenerateMessage }: ChatMessageListProps) => {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const root = scrollRootRef.current;
  const viewport = root?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
  if (!viewport) return;
  requestAnimationFrame(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    // Fallback in case scrollIntoView doesn't work in some contexts
    viewport.scrollTop = viewport.scrollHeight;
  });
}, [messages]);

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard" });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <ScrollArea ref={scrollRootRef} className="flex-1">
      <div className="p-4 pb-28 space-y-1">
        {messages.map((message, idx) => {
          const isUser = message.role === "user";
          const prev = messages[idx - 1];
          const next = messages[idx + 1];
          const isFirstInGroup = !prev || prev.role !== message.role;
          const isLastInGroup = !next || next.role !== message.role;
          const isTyping = typeof message.id === "string" && message.id.includes("typing");

          return (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && isLastInGroup && (
                <div className="shrink-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback aria-label="Assistant avatar">AI</AvatarFallback>
                  </Avatar>
                </div>
              )}

              <div
                className={`group relative rounded-lg px-4 py-3 max-w-[80%] animate-fade-in ${
                  isUser ? "bg-primary text-primary-foreground" : "bg-card border shadow-sm"
                } ${isFirstInGroup ? "mt-3" : "mt-1"} ${isLastInGroup ? "mb-3" : "mb-1"}`}
              >
                {message.role === "assistant" ? (
                  isTyping ? (
                    <div className="flex items-center gap-1" aria-live="polite" aria-label="Assistant is typing">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"></span>
                    </div>
                  ) : (
                    <div className="text-sm prose prose-sm max-w-none dark:prose-invert prose-a:text-primary prose-a:underline hover:prose-a:text-primary/80">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ href, children, ...props }) => {
                            // Security: Only allow safe protocols
                            const safeProtocols = ['http:', 'https:', 'mailto:'];
                            const url = href || '';
                            const protocol = url.split(':')[0] + ':';
                            
                            if (!safeProtocols.includes(protocol)) {
                              return <span>{children}</span>;
                            }
                            
                            return (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline hover:text-primary/80 transition-colors"
                                {...props}
                              >
                                {children}
                              </a>
                            );
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )
                ) : (
                  <div className="text-sm whitespace-pre-wrap">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children, ...props }) => {
                          // Security: Only allow safe protocols
                          const safeProtocols = ['http:', 'https:', 'mailto:'];
                          const url = href || '';
                          const protocol = url.split(':')[0] + ':';
                          
                          if (!safeProtocols.includes(protocol)) {
                            return <span>{children}</span>;
                          }
                          
                          return (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-foreground underline hover:text-primary-foreground/80 transition-colors"
                              {...props}
                            >
                              {children}
                            </a>
                          );
                        },
                        p: ({ children }) => <span>{children}</span>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Message actions */}
                {!isTyping && (
                  <div className="absolute -top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1 bg-background border rounded-md shadow-md p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(message.content)}
                        className="h-6 w-6"
                        title="Copy message"
                        aria-label="Copy message"
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
                          aria-label="Regenerate response"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                {isLastInGroup && (
                  <div className={`text-xs opacity-60 mt-2 ${isUser ? "text-primary-foreground/80" : ""}`}>
                    {formatTime(message.timestamp)}
                  </div>
                )}
              </div>

              {isUser && isLastInGroup && (
                <div className="shrink-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback aria-label="User avatar">U</AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} aria-hidden="true" />
      </div>
    </ScrollArea>
  );
};
