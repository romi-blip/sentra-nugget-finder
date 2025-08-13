import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ChatService } from "@/services/chatService";
import type { ChatSession, Message, ChatSessionsState } from "@/types/chatSession";
import { useToast } from "@/hooks/use-toast";

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrated, setMigrated] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load sessions from database when user is authenticated
  useEffect(() => {
    if (!user) {
      setSessions([]);
      setActiveSessionId(null);
      setLoading(false);
      return;
    }

    const loadSessions = async () => {
      try {
        const { data: conversations, error } = await ChatService.getConversations();
        if (error) {
          console.error("Failed to load conversations:", error);
          toast({
            title: "Error",
            description: "Failed to load conversations",
            variant: "destructive",
          });
          return;
        }

        const sessionsWithMessages = await Promise.all(
          conversations.map(async (conv) => {
            const { data: messages } = await ChatService.getMessages(conv.id);
            return ChatService.convertToLocalSession(conv, messages);
          })
        );

        setSessions(sessionsWithMessages);
        
        // Set active session to most recent if none is set
        if (sessionsWithMessages.length > 0 && !activeSessionId) {
          setActiveSessionId(sessionsWithMessages[0].id);
        }
      } catch (error) {
        console.error("Error loading sessions:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [user, activeSessionId, toast]);

  // Migration effect - only run once when user first authenticates
  useEffect(() => {
    if (user && !migrated) {
      const migrateData = async () => {
        const hasLocalData = localStorage.getItem("chatSessions");
        if (hasLocalData) {
          const { success, error } = await ChatService.migrateLocalStorageData();
          if (success) {
            toast({
              title: "Data Migrated",
              description: "Your chat history has been saved to the cloud",
            });
            // Reload sessions after migration
            window.location.reload();
          } else {
            console.error("Migration failed:", error);
          }
        }
        setMigrated(true);
      };

      migrateData();
    }
  }, [user, migrated, toast]);

  const createNewSession = useCallback(async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create a new chat",
        variant: "destructive",
      });
      return null;
    }

    try {
      const { data: conversation, error } = await ChatService.createConversation("New Chat");
      if (error) {
        console.error("Failed to create conversation:", error);
        toast({
          title: "Error",
          description: "Failed to create new chat",
          variant: "destructive",
        });
        return null;
      }

      // Add welcome message
      const welcomeMessage = {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        content: "Hello! How can I help you today?",
      };

      const { error: messageError } = await ChatService.addMessage(conversation.id, welcomeMessage);
      if (messageError) {
        console.error("Failed to add welcome message:", messageError);
      }

      const newSession: ChatSession = {
        id: conversation.id,
        title: conversation.title,
        messages: [
          {
            ...welcomeMessage,
            timestamp: new Date(),
          },
        ],
        createdAt: new Date(conversation.created_at),
        updatedAt: new Date(conversation.updated_at),
      };

      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      return newSession.id;
    } catch (error) {
      console.error("Error creating session:", error);
      toast({
        title: "Error",
        description: "Failed to create new chat",
        variant: "destructive",
      });
      return null;
    }
  }, [user, toast]);

  const updateSession = useCallback(
    async (sessionId: string, updates: Partial<ChatSession>) => {
      if (!user) return;

      try {
        // Update in database
        const { error } = await ChatService.updateConversation(sessionId, {
          title: updates.title,
        });

        if (error) {
          console.error("Failed to update conversation:", error);
          return;
        }

        // Update local state
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId
              ? { ...session, ...updates, updatedAt: new Date() }
              : session
          )
        );
      } catch (error) {
        console.error("Error updating session:", error);
      }
    },
    [user]
  );

  const addMessage = useCallback(
    async (sessionId: string, message: Omit<Message, "timestamp">) => {
      if (!user) return;

      try {
        // Add to database
        const { data: newMessage, error } = await ChatService.addMessage(sessionId, message);
        if (error) {
          console.error("Failed to add message:", error);
          return;
        }

        const messageWithTimestamp: Message = {
          ...message,
          timestamp: new Date(),
        };

        setSessions((prev) =>
          prev.map((session) => {
            if (session.id === sessionId) {
              const updatedSession = {
                ...session,
                messages: [...session.messages, messageWithTimestamp],
                updatedAt: new Date(),
              };
              
              // Auto-generate title if this is the first user message (after welcome)
              if (
                message.role === "user" &&
                session.messages.length === 1 &&
                session.title === "New Chat"
              ) {
                // Extract first few words as title
                const words = message.content.split(" ").slice(0, 5);
                const newTitle = words.join(" ") + (message.content.split(" ").length > 5 ? "..." : "");
                updatedSession.title = newTitle;
                
                // Update title in database
                ChatService.updateConversation(sessionId, { title: newTitle });
              }
              
              return updatedSession;
            }
            return session;
          })
        );
      } catch (error) {
        console.error("Error adding message:", error);
      }
    },
    [user]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (!user) return;

      try {
        // Delete from database
        const { error } = await ChatService.deleteConversation(sessionId);
        if (error) {
          console.error("Failed to delete conversation:", error);
          return;
        }

        setSessions((prev) => {
          const remainingSessions = prev.filter((session) => session.id !== sessionId);
          
          // If we're deleting the active session, switch to another one
          if (activeSessionId === sessionId) {
            if (remainingSessions.length > 0) {
              setActiveSessionId(remainingSessions[0].id);
            } else {
              setActiveSessionId(null);
            }
          }
          
          return remainingSessions;
        });
      } catch (error) {
        console.error("Error deleting session:", error);
      }
    },
    [activeSessionId, user]
  );

  const renameSession = useCallback(
    async (sessionId: string, newTitle: string) => {
      await updateSession(sessionId, { title: newTitle });
    },
    [updateSession]
  );

  const getActiveSession = useCallback(() => {
    return sessions.find((session) => session.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const replaceMessage = useCallback(
    async (sessionId: string, oldMessageId: string, newMessage: Omit<Message, "timestamp">) => {
      const messageWithTimestamp: Message = {
        ...newMessage,
        timestamp: new Date(),
      };

      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === oldMessageId ? messageWithTimestamp : msg
                ),
                updatedAt: new Date(),
              }
            : session
        )
      );
    },
    []
  );

  const removeMessage = useCallback(
    async (sessionId: string, messageId: string) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: session.messages.filter((msg) => msg.id !== messageId),
                updatedAt: new Date(),
              }
            : session
        )
      );
    },
    []
  );

  const clearActiveSession = useCallback(async () => {
    if (activeSessionId) {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSessionId
            ? {
                ...session,
                messages: [
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: "Hello! How can I help you today?",
                    timestamp: new Date(),
                  },
                ],
                title: "New Chat",
                updatedAt: new Date(),
              }
            : session
        )
      );
    }
  }, [activeSessionId]);

  return {
    sessions,
    activeSessionId,
    loading,
    setActiveSessionId,
    createNewSession,
    updateSession,
    addMessage,
    deleteSession,
    renameSession,
    getActiveSession,
    replaceMessage,
    removeMessage,
    clearActiveSession,
  };
}