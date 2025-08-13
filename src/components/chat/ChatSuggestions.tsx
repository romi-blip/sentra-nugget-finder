import { Button } from "@/components/ui/button";

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
    <section aria-label="Quick suggestions" className="max-w-2xl w-full">
      <h2 className="sr-only">Suggested prompts</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {suggestions.map((text, idx) => (
          <Button
            key={idx}
            type="button"
            variant="secondary"
            className="justify-start text-left whitespace-normal"
            onClick={() => onPick(text)}
          >
            {text}
          </Button>
        ))}
      </div>
    </section>
  );
};
