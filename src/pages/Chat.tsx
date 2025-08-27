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
import { webhookService, createChatJob } from "@/services/webhookService";
import { normalizeAiContent, extractResponseContent } from "@/lib/normalizeAiContent";
import { useChatJobPolling } from "@/hooks/useChatJobPolling";

const Chat = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const {
    sessions,
    activeSessionId,
    loading,
    setActiveSessionId,
    createNewSession,
    addMessage,
    deleteSession,
    renameSession,
    getActiveSession,
    removeMessage,
    clearActiveSession,
    bulkDeleteSessions,
  } = useChatSessions();

  // Abort controller to allow stopping a generation
  const abortRef = useRef<AbortController | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Job polling for async webhook responses
  const { isPolling, stopPolling } = useChatJobPolling({
    jobId: currentJobId,
    onComplete: (result) => {
      if (!activeSessionId) return;
      
      console.log("Chat: Job completed with result:", result);
      
      // Remove typing indicator
      const typingMessages = getActiveSession()?.messages.filter(m => m.content === "⚡ AI is thinking...");
      if (typingMessages?.length) {
        removeMessage(activeSessionId, typingMessages[typingMessages.length - 1].id);
      }
      
      // Process and add the response
      const responseContent = normalizeAiContent(extractResponseContent(result));
      
      // Defensive check: prevent duplicate assistant messages
      const activeSession = getActiveSession();
      const lastMessage = activeSession?.messages[activeSession.messages.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage.content === responseContent) {
        console.log("Chat: Skipping duplicate assistant message");
        setCurrentJobId(null);
        abortRef.current = null;
        return;
      }
      
      const reply = {
        id: `${Date.now()}a`,
        role: "assistant" as const,
        content: responseContent,
      };
      addMessage(activeSessionId, reply);
      
      setCurrentJobId(null);
      abortRef.current = null;
    },
    onError: (error) => {
      if (!activeSessionId) return;
      
      console.error("Chat: Job failed with error:", error);
      
      // Remove typing indicator
      const typingMessages = getActiveSession()?.messages.filter(m => m.content === "⚡ AI is thinking...");
      if (typingMessages?.length) {
        removeMessage(activeSessionId, typingMessages[typingMessages.length - 1].id);
      }
      
      // Show error message
      const reply = {
        id: `${Date.now()}a`,
        role: "assistant" as const,
        content: `Sorry, I encountered an error: ${error}. Please try again or check your webhook configuration.`,
      };
      addMessage(activeSessionId, reply);
      
      setCurrentJobId(null);
      abortRef.current = null;
      
      toast({
        title: "AI Processing Failed",
        description: error,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = async (text: string) => {
    if (!activeSessionId) return;

    // Add user message
    const userMessage = {
      id: `${Date.now()}u`,
      role: "user" as const,
      content: text,
    };
    addMessage(activeSessionId, userMessage);

    // Add typing indicator
    const typingId = `${Date.now()}typing`;
    const typingMessage = {
      id: typingId,
      role: "assistant" as const,
      content: "⚡ AI is thinking...",
    };
    addMessage(activeSessionId, typingMessage);

    // Track any global webhook error for better UX in fallback
    let lastGlobalError: unknown = null;

    // Try async job system first
    try {
      console.log("Chat: Attempting to use async job system");
      
      const { jobId, error: jobError } = await createChatJob(activeSessionId, {
        message: text,
        timestamp: new Date().toISOString(),
        sessionId: activeSessionId,
        messageId: `msg_${Date.now()}`,
      });

      if (jobError) {
        console.error("Chat: Job creation failed:", jobError);
        throw new Error(`Job creation failed: ${jobError.message || 'Unknown error'}`);
      }

      if (jobId) {
        console.log("Chat: Job created successfully, starting polling:", jobId);
        setCurrentJobId(jobId);
        abortRef.current = { abort: () => stopPolling() } as AbortController;
        return; // Let the polling handle the response
      }
      
      throw new Error("Job creation returned no job ID");
    } catch (jobError) {
      lastGlobalError = jobError;
      console.error("Chat: Async job error:", jobError);
      console.log("Chat: Async job failed, trying legacy webhook fallback:", jobError);
    }

    // Fallback to legacy localStorage webhook system
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

    // Additional legacy fallback
    if (!chatWebhookUrl) {
      chatWebhookUrl = localStorage.getItem("n8nWebhookUrl");
    }

    if (!chatWebhookUrl) {
      console.warn("Chat: Global webhook failed; no legacy webhook configured. Showing helpful error message.");
      removeMessage(activeSessionId, typingId);
      const friendlyReason = lastGlobalError instanceof Error ? lastGlobalError.message : 'Unknown error';
      const reply = {
        id: `${Date.now()}a`,
        role: "assistant" as const,
        content:
          `AI service error: ${friendlyReason}. Please verify your webhook settings in Settings. If this was a timeout, note we now allow up to 180s.`,
      };
      addMessage(activeSessionId, reply);
      toast({
        title: "AI service unavailable",
        description: `Global webhook failed: ${friendlyReason}`,
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Chat: Sending request to legacy webhook:", chatWebhookUrl);
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

          // Extract and normalize the response content
          const rawContent = extractResponseContent(data);
          assistantResponse = normalizeAiContent(rawContent);
        } catch (parseError) {
          console.error("Chat: JSON parse error:", parseError);
          throw new Error(
            `Invalid JSON format from webhook. Expected JSON but got malformed data: ${responseText.substring(0, 100)}...`
          );
        }
      } else {
        // Plain text/markdown response - normalize using robust utility
        console.log("Chat: Detected plain text/markdown format response");
        assistantResponse = normalizeAiContent(responseText);

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
          onBulkDeleteSessions={bulkDeleteSessions}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="sticky top-16 z-40 border-b shadow-sm bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">AI Sales Copilot</h1>
                <p className="text-sm text-muted-foreground">{getActiveSession()?.title || "New Chat"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={clearActiveSession} disabled={!getActiveSession()}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Chat
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Chat Content */}
        <div className="flex-1 min-h-0 flex flex-col">
          {getActiveSession() ? (
            <>
              {getActiveSession()?.messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-6">
                  <ChatSuggestions onPick={(text) => handleSendMessage(text)} />
                </div>
              ) : (
                <ChatMessageList messages={getActiveSession()?.messages || []} />
              )}
              <ChatInput 
                onSend={handleSendMessage} 
                onStop={() => {
                  if (isPolling) {
                    stopPolling();
                    setCurrentJobId(null);
                  }
                  abortRef.current?.abort();
                }} 
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Welcome to AI Sales Copilot</h2>
                  <p className="text-muted-foreground mb-4">Get started with one of these suggestions or create a new chat</p>
                </div>
                <ChatSuggestions onPick={(text) => {
                  createNewSession();
                  // Small delay to ensure session is created before sending message
                  setTimeout(() => handleSendMessage(text), 100);
                }} />
                <Button onClick={createNewSession} variant="outline">
                  Start New Chat
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
