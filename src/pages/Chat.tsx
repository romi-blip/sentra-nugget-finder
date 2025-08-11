import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import SEO from "@/components/SEO";
import { toast } from "@/hooks/use-toast";

interface Message { id: string; role: "user" | "assistant"; content: string; }

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: "w", role: "assistant", content: "Hi! Ask about content to share with your prospect. I’ll search your knowledge base once connected." },
  ]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages.length]);

  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = { id: `${Date.now()}u`, role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    const webhook = localStorage.getItem("n8nWebhookUrl");
    if (!webhook) {
      const reply: Message = {
        id: `${Date.now()}a`,
        role: 'assistant',
        content: "To enable AI answers using your knowledge base, add your n8n webhook in Settings and connect Supabase. For now, here’s a generic tip: share a 1-pager with a crisp value prop and 3 proof points, then a case study based on prospect industry.",
      };
      setMessages((m) => [...m, reply]);
      toast({ title: "Connect backend", description: "Add your n8n webhook in Settings to enable RAG chat." });
      return;
    }

    // Placeholder echo; backend integration will stream real answers
    const reply: Message = {
      id: `${Date.now()}a`,
      role: 'assistant',
      content: `Got it: "${text}". Once connected, I will query your vector DB for tailored content and draft an email/LinkedIn message.`,
    };
    setMessages((m) => [...m, reply]);
  };

  return (
    <main className="min-h-screen">
      <SEO title="Sentra AI Chat" description="Chat with an assistant grounded in your knowledge base to get content and messaging suggestions." canonicalPath="/chat" />

      <section className="bg-hero">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">AI Sales Copilot</h1>
          <p className="text-muted-foreground">Ask for what to share next and get suggested snippets for email, LinkedIn or talk tracks.</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <Card className="glass-card">
          <CardContent className="p-0">
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-lg px-4 py-3 max-w-[80%] ${m.role === 'user' ? 'bg-secondary' : 'bg-card'} shadow-elevated`}>
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex items-center gap-2">
              <Input
                placeholder="Ask for content ideas or draft a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSend()}
              />
              <Button variant="hero" onClick={onSend}>Send</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Chat;
