import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatSuggestionsProps {
  onPick: (text: string) => void;
}

export const ChatSuggestions = ({ onPick }: ChatSuggestionsProps) => {
  const suggestions = [
    "Write a 3-step cold outreach email for a SaaS selling to marketing leaders.",
    "Summarize this sales call transcript and list 5 next steps.",
    "Draft a friendly LinkedIn DM to follow up after a webinar.",
    "Create a discovery call agenda with 7 targeted questions.",
  ];

  return (
    <section aria-label="Quick suggestions" className="max-w-3xl w-full px-4">
      <h2 className="text-sm font-medium text-muted-foreground mb-4 text-center">
        Try one of these prompts
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {suggestions.map((text, idx) => (
          <Button
            key={idx}
            type="button"
            variant="outline"
            className={cn(
              "justify-start text-left whitespace-normal h-auto py-4 px-4",
              "hover:bg-[hsl(var(--chat-hover))] hover:border-primary/50",
              "transition-all duration-200 hover:shadow-md hover:scale-[1.02]",
              "text-sm leading-relaxed"
            )}
            onClick={() => onPick(text)}
          >
            <span className="text-primary mr-2 text-lg">→</span>
            {text}
          </Button>
        ))}
      </div>
    </section>
  );
};
