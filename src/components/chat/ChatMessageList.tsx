import { memo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, RotateCcw, User, Bot, ArrowDown } from "lucide-react";
import { Message } from "@/types/chatSession";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeAiContent } from "@/lib/normalizeAiContent";
import { cn } from "@/lib/utils";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { StreamingMessage } from "./StreamingMessage";
import { TypingIndicator } from "./TypingIndicator";

interface ChatMessageListProps {
  messages: Message[];
  isStreaming: boolean;
  onRegenerateMessage?: (messageId: string) => void;
}

export const ChatMessageList = memo(({ messages, isStreaming, onRegenerateMessage }: ChatMessageListProps) => {
  const { scrollRef, endRef, isUserScrolled, scrollToBottom } = useAutoScroll([messages, isStreaming]);

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard" });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const lastMessage = messages[messages.length - 1];
  const showTypingIndicator = isStreaming && lastMessage?.role === "assistant" && !lastMessage.content;

  return (
    <div className="flex-1 min-h-0 relative">
      <ScrollArea ref={scrollRef} className="h-full smooth-scroll">
        <div className="flex flex-col gap-6 p-4 md:p-6 pb-4 max-w-3xl mx-auto">
          {messages.map((message, idx) => {
            const isUser = message.role === "user";
            const prev = messages[idx - 1];
            const next = messages[idx + 1];
            const isFirstInGroup = !prev || prev.role !== message.role;
            const isLastInGroup = !next || next.role !== message.role;
            const isTyping = typeof message.id === "string" && message.id.includes("typing");
            const isStreamingThisMessage = isStreaming && idx === messages.length - 1 && !isUser && message.content;
            const showTimestamp = idx === 0 || 
              (prev && prev.role !== message.role) ||
              (prev && message.timestamp.getTime() - prev.timestamp.getTime() > 300000);

          return (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 group chat-message-enter",
                isUser ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* Avatar - only show for last message in group */}
              {((isUser && isLastInGroup) || (!isUser && isLastInGroup)) && (
                <Avatar className="h-9 w-9 shrink-0 shadow-sm">
                  {isUser ? (
                    <>
                      <AvatarImage src="/placeholder.svg" />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </>
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  )}
                </Avatar>
              )}
              {/* Spacer when avatar is not shown */}
              {((isUser && !isLastInGroup) || (!isUser && !isLastInGroup)) && (
                <div className="h-9 w-9 shrink-0" />
              )}

              {/* Message content */}
              <div className={cn(
                "flex flex-col gap-1.5 max-w-[85%] md:max-w-[75%]",
                isUser ? "items-end" : "items-start"
              )}>
                {showTimestamp && (
                  <span className="text-xs text-muted-foreground/70 px-2 font-medium">
                    {formatTime(message.timestamp)}
                  </span>
                )}
                
                <div className={cn(
                  "relative rounded-2xl px-4 py-3 shadow-sm transition-all duration-200",
                  isUser 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "bg-[hsl(var(--chat-bubble-assistant))] text-[hsl(var(--chat-text-assistant))] border border-[hsl(var(--chat-border))]",
                  "hover:shadow-md",
                  isFirstInGroup ? "mt-0" : "mt-1"
                )}>
                  {isUser ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  ) : isTyping && !isStreamingThisMessage ? (
                    <TypingIndicator />
                  ) : isStreamingThisMessage ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <StreamingMessage content={message.content} isStreaming={true} />
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ href, children, ...props }) => {
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
                                className={cn(
                                  "underline underline-offset-2 transition-colors",
                                  "text-primary hover:text-primary/80"
                                )}
                                {...props}
                              >
                                {children}
                              </a>
                            );
                          },
                          p: ({ children, ...props }) => (
                            <p {...props} className="mb-2 last:mb-0 leading-relaxed">
                              {children}
                            </p>
                          ),
                          code: ({ children, ...props }) => (
                            <code 
                              {...props} 
                              className={cn(
                                "px-1.5 py-0.5 rounded text-sm font-mono",
                                "bg-muted"
                              )}
                            >
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {normalizeAiContent(message.content)}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                {/* Message actions - only for assistant messages */}
                {!isUser && !isTyping && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(message.content)}
                      className="h-8 px-2 hover:bg-[hsl(var(--chat-hover))]"
                      aria-label="Copy message"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {onRegenerateMessage && idx === messages.length - 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRegenerateMessage(message.id)}
                        className="h-8 px-2 hover:bg-[hsl(var(--chat-hover))]"
                        aria-label="Regenerate response"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
            );
          })}
          
          
          <div ref={endRef} aria-hidden="true" />
        </div>
      </ScrollArea>
      
      {isUserScrolled && (
        <Button
          onClick={scrollToBottom}
          size="icon"
          className="absolute bottom-6 right-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-10 animate-slide-up"
          variant="default"
        >
          <ArrowDown className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
});

ChatMessageList.displayName = "ChatMessageList";
