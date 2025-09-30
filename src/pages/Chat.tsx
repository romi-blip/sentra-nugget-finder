import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { toast } from "@/hooks/use-toast";
import { useChatSessions } from "@/hooks/useChatSessions";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { Trash2, Bot } from "lucide-react";
import { ChatSuggestions } from "@/components/chat/ChatSuggestions";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { cn } from "@/lib/utils";

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
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 md:p-6 shadow-sm">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                {getActiveSession()?.title || "AI Sales Copilot"}
              </h1>
              {isStreaming && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse-soft"></span>
                  Generating response...
                </p>
              )}
            </div>
            {getActiveSession() && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearActiveSession}
                className="hover:bg-[hsl(var(--chat-hover))]"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </header>

        {/* Chat Content */}
        {!getActiveSession() || getActiveSession()?.messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6 md:p-8">
            <div className="text-center space-y-8 max-w-3xl animate-fade-in">
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Welcome to AI Sales Copilot
                </h2>
                <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto leading-relaxed">
                  Your intelligent assistant for sales and customer engagement. Ask me anything or try one of the prompts below.
                </p>
              </div>
              <ChatSuggestions onPick={getActiveSession() ? handleSendMessage : (text) => {
                createNewSession();
                setTimeout(() => handleSendMessage(text), 100);
              }} />
            </div>
          </div>
        ) : (
          <>
            <ChatMessageList messages={getActiveSession()?.messages || []} />
            <ChatInput 
              onSend={handleSendMessage} 
              onStop={isStreaming ? stopStreaming : undefined}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Chat;
