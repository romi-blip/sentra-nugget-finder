import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput = ({
  onSend,
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
    <div className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Textarea
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            className="min-h-[60px] max-h-[200px] resize-none"
            rows={1}
          />
          <div className="text-xs text-muted-foreground mt-1">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
        <Button
          onClick={handleSend}
          disabled={!input.trim() || disabled || isLoading}
          size="sm"
          className="px-4"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};