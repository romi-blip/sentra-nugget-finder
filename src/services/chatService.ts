import { supabase } from "@/integrations/supabase/client";
import type { ChatSession, Message } from "@/types/chatSession";

export class ChatService {
  // Conversations
  static async createConversation(title: string): Promise<{ data: any; error: any }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: { message: "User not authenticated" } };
    }

    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({
        user_id: user.id,
        title: title || 'New Chat',
      })
      .select()
      .single();

    return { data, error };
  }

  static async getConversations(): Promise<{ data: any[]; error: any }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: [], error: { message: "User not authenticated" } };
    }

    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    return { data: data || [], error };
  }

  static async updateConversation(id: string, updates: Partial<{ title: string }>): Promise<{ error: any }> {
    const { error } = await supabase
      .from('chat_conversations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return { error };
  }

  static async deleteConversation(id: string): Promise<{ error: any }> {
    // Delete messages first (cascade should handle this, but being explicit)
    await supabase
      .from('chat_messages')
      .delete()
      .eq('conversation_id', id);

    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', id);

    return { error };
  }

  // Messages
  static async addMessage(conversationId: string, message: Omit<Message, "timestamp">): Promise<{ data: any; error: any }> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        role: message.role,
        content: message.content,
      })
      .select()
      .single();

    // Update conversation timestamp
    if (!error) {
      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    return { data, error };
  }

  static async getMessages(conversationId: string): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    return { data: data || [], error };
  }

  // Helper to convert database records to local types
  static convertToLocalSession(conversation: any, messages: any[] = []): ChatSession {
    return {
      id: conversation.id,
      title: conversation.title || 'New Chat',
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at),
      })),
      createdAt: new Date(conversation.created_at),
      updatedAt: new Date(conversation.updated_at),
    };
  }

  // Migration helper to move localStorage data to database
  static async migrateLocalStorageData(): Promise<{ success: boolean; error?: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { message: "User not authenticated" } };
      }

      // Get existing data from localStorage
      const existingSessions = localStorage.getItem('chatSessions');
      if (!existingSessions) {
        return { success: true }; // Nothing to migrate
      }

      const sessions: ChatSession[] = JSON.parse(existingSessions);
      
      for (const session of sessions) {
        // Create conversation
        const { data: conversation, error: convError } = await this.createConversation(session.title);
        if (convError) {
          console.error('Error migrating conversation:', convError);
          continue;
        }

        // Add messages
        for (const message of session.messages) {
          const { error: msgError } = await this.addMessage(conversation.id, {
            id: message.id,
            role: message.role,
            content: message.content,
          });
          if (msgError) {
            console.error('Error migrating message:', msgError);
          }
        }
      }

      // Clear localStorage after successful migration
      localStorage.removeItem('chatSessions');
      localStorage.removeItem('activeSessionId');

      return { success: true };
    } catch (error) {
      console.error('Migration error:', error);
      return { success: false, error };
    }
  }

  // Real-time subscription for messages
  static subscribeToMessages(conversationId: string, callback: (message: any) => void) {
    return supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        callback
      )
      .subscribe();
  }

  // Real-time subscription for conversations
  static async subscribeToConversations(callback: (conversation: any) => void) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    return supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations',
          filter: `user_id=eq.${user.id}`,
        },
        callback
      )
      .subscribe();
  }
}