import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { toast } from "@/hooks/use-toast";
import { useChatSessions } from "@/hooks/useChatSessions";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { Trash2 } from "lucide-react";
import { ChatSuggestions } from "@/components/chat/ChatSuggestions";

const Chat = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const {
    sessions,
    activeSessionId,
    activeSession,
    setActiveSessionId,
    createNewSession,
    addMessage,
    removeMessage,
    deleteSession,
    renameSession,
    clearActiveSession,
  } = useChatSessions();

  // Abort controller to allow stopping a generation
  const abortRef = useRef<AbortController | null>(null);

  const handleSendMessage = async (text: string) => {
    if (!activeSessionId) return;

    // Add user message
    const userMessage = {
      id: `${Date.now()}u`,
      role: "user" as const,
      content: text,
    };
    addMessage(activeSessionId, userMessage);

    // Get chat webhook from new webhook system
    const webhookData = localStorage.getItem("n8n_webhook_configs");
    let chatWebhookUrl: string | null = null;

    if (webhookData) {
      try {
        const { webhooks } = JSON.parse(webhookData);
        const chatWebhook = webhooks.find((w: any) => w.type === "chat" && w.enabled && w.url);
        chatWebhookUrl = chatWebhook?.url || null;
      } catch (e) {
        console.error("Failed to parse webhook config:", e);
      }
    }

    // Fallback to legacy webhook
    if (!chatWebhookUrl) {
      chatWebhookUrl = localStorage.getItem("n8nWebhookUrl");
    }

    if (!chatWebhookUrl) {
      const reply = {
        id: `${Date.now()}a`,
        role: "assistant" as const,
        content:
          "To enable AI answers using your knowledge base, configure your chat webhook in Settings. For now, here's a generic tip: share a 1-pager with a crisp value prop and 3 proof points, then a case study based on prospect industry.",
      };
      addMessage(activeSessionId, reply);
      toast({
        title: "Configure Webhook",
        description: "Add your chat webhook in Settings to enable AI responses.",
      });
      return;
    }

    // Add typing indicator
    const typingId = `${Date.now()}typing`;
    const typingMessage = {
      id: typingId,
      role: "assistant" as const,
      content: "⚡ AI is thinking...",
    };
    addMessage(activeSessionId, typingMessage);

    try {
      console.log("Chat: Sending request to webhook:", chatWebhookUrl);
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(chatWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          timestamp: new Date().toISOString(),
          sessionId: activeSessionId, // keep same session for context
          messageId: `msg_${Date.now()}`,
        }),
      });

      console.log("Chat: Response status:", response.status);
      console.log("Chat: Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get response as text first to check format
      const responseText = await response.text();
      console.log("Chat: Raw response text:", responseText);

      if (!responseText || responseText.trim() === "") {
        throw new Error("Webhook returned empty response");
      }

      let assistantResponse: string;

      // Detect response format and handle accordingly
      const trimmedResponse = responseText.trim();

      if (trimmedResponse.startsWith("[") || trimmedResponse.startsWith("{")) {
        // Looks like JSON, try to parse it
        console.log("Chat: Detected JSON format response");
        try {
          const data = JSON.parse(responseText);
          console.log("Chat: Successfully parsed JSON:", data);

          // Extract the message from N8N response format
          if (Array.isArray(data) && data.length > 0 && (data[0] as any).output) {
            assistantResponse = (data[0] as any).output as string;
          } else if ((data as any).response || (data as any).message || (data as any).content) {
            assistantResponse = (data as any).response || (data as any).message || (data as any).content;
          } else {
            assistantResponse = "I received your message but couldn't extract a proper response from the JSON.";
          }
        } catch (parseError) {
          console.error("Chat: JSON parse error:", parseError);
          throw new Error(
            `Invalid JSON format from webhook. Expected JSON but got malformed data: ${responseText.substring(0, 100)}...`
          );
        }
      } else {
        // Plain text/markdown response
        console.log("Chat: Detected plain text/markdown format response");

        // Extract markdown when response is wrapped in an iframe srcdoc
        let cleanedResponse = responseText.trim();
        if (/^<iframe[\s\S]*srcdoc=/i.test(cleanedResponse)) {
          try {
            const srcdocMatch = cleanedResponse.match(/srcdoc=(?:"([^"]*)"|'([^']*)')/i);
            if (srcdocMatch) {
              let srcdoc = (srcdocMatch[1] ?? srcdocMatch[2] ?? "");
              // Preserve HTML line breaks
              srcdoc = srcdoc.replace(/<br\s*\/?\s*>/gi, "\n");
              const doc = new DOMParser().parseFromString(srcdoc, "text/html");
              const decoded = doc.documentElement.textContent || "";
              cleanedResponse = decoded;
            }
          } catch (e) {
            console.warn("Chat: Failed to parse iframe srcdoc, falling back to raw text.", e);
          }
        }

        // Strip markdown code block markers if present
        // Handle ```markdown blocks
        if (cleanedResponse.startsWith("```markdown\n") && cleanedResponse.endsWith("\n```")) {
          cleanedResponse = cleanedResponse.slice(12, -4); // Remove ```markdown\n from start and \n``` from end
        } else if (cleanedResponse.startsWith("```markdown") && cleanedResponse.endsWith("```")) {
          cleanedResponse = cleanedResponse.slice(11, -3); // Remove ```markdown from start and ``` from end
        }
        // Handle generic code blocks
        else if (cleanedResponse.startsWith("```") && cleanedResponse.endsWith("```")) {
          const firstNewline = cleanedResponse.indexOf("\n");
          if (firstNewline > 0) {
            cleanedResponse = cleanedResponse.slice(firstNewline + 1, -3);
          } else {
            // No newline found, just remove the markers
            cleanedResponse = cleanedResponse.slice(3, -3);
          }
        }

        assistantResponse = cleanedResponse.trim();

        // Log a warning about inconsistent webhook format
        console.warn(
          "Chat: Webhook returned plain text instead of expected JSON format. Consider configuring your N8N workflow to return consistent JSON: [{\"output\": \"your message\"}]"
        );
      }

      // Remove typing indicator and add real response
      removeMessage(activeSessionId, typingId);
      const reply = {
        id: `${Date.now()}a`,
        role: "assistant" as const,
        content: assistantResponse,
      };
      addMessage(activeSessionId, reply);
      abortRef.current = null;
      return; // Successfully processed
    } catch (error) {
      console.error("Chat: Full error details:", error);

      // Remove typing indicator
      removeMessage(activeSessionId, typingId);

      // Handle user-initiated aborts gracefully
      if (error instanceof DOMException && error.name === "AbortError") {
        abortRef.current = null;
        toast({ title: "Generation stopped" });
        return;
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      const reply = {
        id: `${Date.now()}a`,
        role: "assistant" as const,
        content: `Sorry, I encountered an error: ${errorMessage}. Please check your webhook configuration in Settings.`,
      };
      addMessage(activeSessionId, reply);

      toast({
        title: "Connection Failed",
        description: "Failed to reach the chat webhook. Please check your configuration.",
        variant: "destructive",
      });
      abortRef.current = null;
    }
  };

  return (
    <div className="min-h-screen flex w-full">
      <SEO
        title="Sentra AI Chat"
        description="Chat with an assistant grounded in your knowledge base to get content and messaging suggestions."
        canonicalPath="/chat"
      />

      {/* Sidebar */}
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSessionSelect={setActiveSessionId}
        onNewSession={createNewSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">AI Sales Copilot</h1>
                <p className="text-sm text-muted-foreground">{activeSession?.title || "New Chat"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={clearActiveSession} disabled={!activeSession}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Chat
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Chat Content */}
        <div className="flex-1 min-h-0 flex flex-col">
          {activeSession ? (
            <>
              {activeSession.messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-6">
                  <ChatSuggestions onPick={(text) => handleSendMessage(text)} />
                </div>
              ) : (
                <ChatMessageList messages={activeSession.messages} />
              )}
              <ChatInput onSend={handleSendMessage} onStop={() => abortRef.current?.abort()} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">No chat session selected</h2>
                <p className="text-muted-foreground mb-4">Create a new chat session to start conversing with the AI</p>
                <Button onClick={createNewSession}>Start New Chat</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
