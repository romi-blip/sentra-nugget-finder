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
import { useStreamingChat } from "@/hooks/useStreamingChat";

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

  const streamingMessageRef = useRef<string>('');
  const typingIdRef = useRef<string>('');

  const [streamingContent, setStreamingContent] = useState<string>('');
  const [, forceUpdate] = useState({});

  const { isStreaming, sendMessage: sendStreamingMessage, stopStreaming } = useStreamingChat({
    onChunk: (chunk) => {
      if (!activeSessionId || !typingIdRef.current) return;
      
      console.log('💬 Chunk received in Chat.tsx:', chunk.substring(0, 50));
      streamingMessageRef.current += chunk;
      setStreamingContent(streamingMessageRef.current);
      console.log('📊 Total content length:', streamingMessageRef.current.length);
      
      // Update the message with the streaming content
      const session = getActiveSession();
      if (session) {
        const messageIndex = session.messages.findIndex(msg => msg.id === typingIdRef.current);
        if (messageIndex !== -1) {
          // Update the message content directly
          session.messages[messageIndex].content = streamingMessageRef.current;
          // Force a re-render
          forceUpdate({});
          console.log('🔄 Updated message at index', messageIndex, 'with content length:', streamingMessageRef.current.length);
        }
      }
    },
    onComplete: (fullMessage) => {
      if (!activeSessionId || !typingIdRef.current) return;
      
      console.log('✨ Stream complete, final message length:', fullMessage.length);
      console.log('📄 First 100 chars:', fullMessage.substring(0, 100));
      
      // Replace typing indicator with final message
      removeMessage(activeSessionId, typingIdRef.current);
      
      const reply = {
        id: `${Date.now()}a`,
        role: "assistant" as const,
        content: fullMessage,
      };
      addMessage(activeSessionId, reply);
      
      streamingMessageRef.current = '';
      typingIdRef.current = '';
      setStreamingContent('');
    },
    onError: (error) => {
      if (!activeSessionId) return;
      
      console.error('Streaming error:', error);
      
      // Remove typing indicator
      if (typingIdRef.current) {
        removeMessage(activeSessionId, typingIdRef.current);
      }
      
      const reply = {
        id: `${Date.now()}a`,
        role: "assistant" as const,
        content: `Sorry, I encountered an error: ${error}. Please try again.`,
      };
      addMessage(activeSessionId, reply);
      
      streamingMessageRef.current = '';
      typingIdRef.current = '';
      setStreamingContent('');
      
      toast({
        title: "Streaming Failed",
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

    // Add streaming indicator
    const typingId = `${Date.now()}typing`;
    typingIdRef.current = typingId;
    streamingMessageRef.current = '';
    
    const typingMessage = {
      id: typingId,
      role: "assistant" as const,
      content: "",
    };
    addMessage(activeSessionId, typingMessage);

    try {
      console.log("🚀 Chat: Starting streaming message for session:", activeSessionId);
      await sendStreamingMessage(activeSessionId, text);
      console.log("✅ Chat: Streaming completed");
    } catch (error) {
      console.error("❌ Chat: Streaming failed:", error);
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
                  if (isStreaming) {
                    stopStreaming();
                  }
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
