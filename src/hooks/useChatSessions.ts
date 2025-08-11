import { useState, useEffect, useCallback } from "react";
import { ChatSession, Message } from "@/types/chatSession";

const STORAGE_KEY = "chatSessions";
const MAX_SESSIONS = 50;

export const useChatSessions = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const sessionsWithDates = parsed.map((session: any) => ({
          ...session,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          messages: session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        }));
        setSessions(sessionsWithDates);
        
        // Set the most recent session as active if none is set
        if (sessionsWithDates.length > 0 && !activeSessionId) {
          setActiveSessionId(sessionsWithDates[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load chat sessions:", error);
    }
  }, []);

  // Save sessions to localStorage whenever sessions change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error("Failed to save chat sessions:", error);
    }
  }, [sessions]);

  const createNewSession = useCallback(() => {
    const newSession: ChatSession = {
      id: `session_${Date.now()}`,
      title: "New Chat",
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content: "Hi! Ask about content to share with your prospect. I'll search your knowledge base once connected.",
          timestamp: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setSessions((prev) => {
      const updated = [newSession, ...prev];
      // Keep only the most recent sessions
      return updated.slice(0, MAX_SESSIONS);
    });
    setActiveSessionId(newSession.id);
    return newSession.id;
  }, []);

  const updateSession = useCallback((sessionId: string, updates: Partial<ChatSession>) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? { ...session, ...updates, updatedAt: new Date() }
          : session
      )
    );
  }, []);

  const addMessage = useCallback((sessionId: string, message: Omit<Message, "timestamp">) => {
    const messageWithTimestamp: Message = {
      ...message,
      timestamp: new Date(),
    };

    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === sessionId) {
          const updatedMessages = [...session.messages, messageWithTimestamp];
          let title = session.title;
          
          // Auto-generate title from first user message
          if (title === "New Chat" && message.role === "user") {
            title = message.content.length > 50 
              ? message.content.substring(0, 50) + "..."
              : message.content;
          }

          return {
            ...session,
            title,
            messages: updatedMessages,
            updatedAt: new Date(),
          };
        }
        return session;
      })
    );
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    
    // If we deleted the active session, switch to the next available one
    if (activeSessionId === sessionId) {
      setSessions((currentSessions) => {
        const remaining = currentSessions.filter((session) => session.id !== sessionId);
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
        } else {
          // No sessions left, create a new one
          const newSessionId = createNewSession();
          setActiveSessionId(newSessionId);
        }
        return remaining;
      });
    }
  }, [activeSessionId, createNewSession]);

  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    updateSession(sessionId, { title: newTitle });
  }, [updateSession]);

  const getActiveSession = useCallback(() => {
    return sessions.find((session) => session.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const replaceMessage = useCallback((sessionId: string, oldMessageId: string, newMessage: Omit<Message, "timestamp">) => {
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
  }, []);

  const removeMessage = useCallback((sessionId: string, messageId: string) => {
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
  }, []);

  const clearActiveSession = useCallback(() => {
    if (activeSessionId) {
      updateSession(activeSessionId, {
        messages: [
          {
            id: "welcome",
            role: "assistant",
            content: "Hi! Ask about content to share with your prospect. I'll search your knowledge base once connected.",
            timestamp: new Date(),
          },
        ],
        title: "New Chat",
      });
    }
  }, [activeSessionId, updateSession]);

  // Initialize with a session if none exist
  useEffect(() => {
    if (sessions.length === 0) {
      createNewSession();
    }
  }, [sessions.length, createNewSession]);

  return {
    sessions,
    activeSessionId,
    activeSession: getActiveSession(),
    setActiveSessionId,
    createNewSession,
    updateSession,
    addMessage,
    replaceMessage,
    removeMessage,
    deleteSession,
    renameSession,
    clearActiveSession,
  };
};
