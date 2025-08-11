import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import SEO from "@/components/SEO";
import { toast } from "@/hooks/use-toast";

interface Message { id: string; role: "user" | "assistant"; content: string; }

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: "w", role: "assistant", content: "Hi! Ask about content to share with your prospect. I'll search your knowledge base once connected." },
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

    // Get chat webhook from new webhook system
    const webhookData = localStorage.getItem("n8n_webhook_configs");
    let chatWebhookUrl: string | null = null;
    
    if (webhookData) {
      try {
        const { webhooks } = JSON.parse(webhookData);
        const chatWebhook = webhooks.find((w: any) => w.type === 'chat' && w.enabled && w.url);
        chatWebhookUrl = chatWebhook?.url || null;
      } catch (e) {
        console.error('Failed to parse webhook config:', e);
      }
    }

    // Fallback to legacy webhook
    if (!chatWebhookUrl) {
      chatWebhookUrl = localStorage.getItem("n8nWebhookUrl");
    }

    if (!chatWebhookUrl) {
      const reply: Message = {
        id: `${Date.now()}a`,
        role: 'assistant',
        content: "To enable AI answers using your knowledge base, configure your chat webhook in Settings. For now, here's a generic tip: share a 1-pager with a crisp value prop and 3 proof points, then a case study based on prospect industry.",
      };
      setMessages((m) => [...m, reply]);
      toast({ title: "Configure Webhook", description: "Add your chat webhook in Settings to enable AI responses." });
      return;
    }

    // Add typing indicator
    const typingId = `${Date.now()}typing`;
    const typingMsg: Message = { id: typingId, role: 'assistant', content: '⚡ AI is thinking...' };
    setMessages((m) => [...m, typingMsg]);

    try {
      console.log('Chat: Sending request to webhook:', chatWebhookUrl);
      
      const response = await fetch(chatWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          timestamp: new Date().toISOString(),
          sessionId: `session_${Date.now()}`,
        }),
      });

      console.log('Chat: Response status:', response.status);
      console.log('Chat: Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get response as text first to check if it's valid JSON
      const responseText = await response.text();
      console.log('Chat: Raw response text:', responseText);

      if (!responseText || responseText.trim() === '') {
        throw new Error('Webhook returned empty response');
      }

      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Chat: Parsed JSON data:', data);
      } catch (parseError) {
        console.error('Chat: JSON parse error:', parseError);
        throw new Error(`Invalid JSON response from webhook: ${responseText.substring(0, 100)}...`);
      }

      const assistantResponse = (() => {
        // Handle N8N array response format: [{ "output": "message" }]
        if (Array.isArray(data) && data.length > 0 && data[0].output) {
          return data[0].output;
        }
        // Handle direct object formats
        return data.response || data.message || data.content || "I received your message but couldn't generate a proper response.";
      })();

      // Remove typing indicator and add real response
      setMessages((m) => m.filter(msg => msg.id !== typingId));
      const reply: Message = {
        id: `${Date.now()}a`,
        role: 'assistant',
        content: assistantResponse,
      };
      setMessages((m) => [...m, reply]);

    } catch (error) {
      console.error('Chat: Full error details:', error);
      
      // Remove typing indicator
      setMessages((m) => m.filter(msg => msg.id !== typingId));
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const reply: Message = {
        id: `${Date.now()}a`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}. Please check your webhook configuration in Settings.`,
      };
      setMessages((m) => [...m, reply]);
      
      toast({
        title: "Connection Failed",
        description: "Failed to reach the chat webhook. Please check your configuration.",
        variant: "destructive",
      });
    }
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