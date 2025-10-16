import { useState, KeyboardEvent, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput = ({
  onSend,
  onStop,
  disabled = false,
  placeholder = "Ask for content ideas or draft a message...",
}: ChatInputProps) => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Dynamic textarea auto-resize
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 200; // max-h-[200px]
    
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
  }, [input]);

  const handleSend = async () => {
    const message = input.trim();
    if (!message || isLoading) return;

    setIsLoading(true);
    try {
      await onSend(message);
      setInput("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              rows={1}
              className="min-h-[56px] resize-none rounded-2xl px-4 py-3 pr-12 text-base shadow-sm transition-all duration-200 focus-visible:shadow-md focus-visible:ring-2 overflow-hidden"
              style={{ height: '56px' }}
              aria-label="Message input"
            />
            {input.length > 0 && (
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground/50 pointer-events-none">
                {input.length} char{input.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <Button
            onClick={isLoading && onStop ? onStop : handleSend}
            disabled={disabled || isLoading || (!onStop && !input.trim())}
            size="icon"
            className={cn(
              "h-14 w-14 rounded-full shrink-0 shadow-lg transition-all duration-200",
              onStop 
                ? "bg-destructive hover:bg-destructive/90" 
                : "bg-primary hover:bg-primary/90 hover:scale-105"
            )}
            aria-label={onStop ? "Stop generation" : "Send message"}
          >
            {isLoading && !onStop ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : onStop ? (
              <Square className="h-5 w-5 fill-current" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground/60 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
