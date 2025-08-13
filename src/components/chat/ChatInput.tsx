import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Square } from "lucide-react";

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
    <div className="sticky bottom-0 z-30 p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Textarea
            aria-label="Message"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            className="min-h-[60px] max-h-[200px] resize-none"
            rows={1}
          />
        </div>
        <Button
          onClick={isLoading && onStop ? onStop : handleSend}
          disabled={(!input.trim() && !(isLoading && onStop)) || disabled}
          size="sm"
          className="px-4"
          aria-label={isLoading && onStop ? "Stop generating" : "Send message"}
          title={isLoading && onStop ? "Stop generating" : "Send message"}
        >
          {isLoading && onStop ? (
            <Square className="h-4 w-4" />
          ) : isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="text-xs text-muted-foreground mt-1">Press Enter to send, Shift+Enter for new line</div>
    </div>
  );
};
