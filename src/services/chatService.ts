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

  // User preferences management
  static async getUserPreferences(): Promise<{ data: any; error: any }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: { message: "User not authenticated" } };
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    return { data, error };
  }

  static async setMigrationCompleted(): Promise<{ error: any }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: { message: "User not authenticated" } };
    }

    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        migration_completed: true,
      });

    return { error };
  }

  // Bulk operations
  static async bulkDeleteConversations(conversationIds: string[]): Promise<{ error: any }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: { message: "User not authenticated" } };
    }

    // Delete messages first
    await supabase
      .from('chat_messages')
      .delete()
      .in('conversation_id', conversationIds);

    // Delete conversations
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .in('id', conversationIds)
      .eq('user_id', user.id);

    return { error };
  }

  // Migration helper to move localStorage data to database
  static async migrateLocalStorageData(): Promise<{ success: boolean; error?: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { message: "User not authenticated" } };
      }

      // Check if migration was already completed
      const { data: preferences } = await this.getUserPreferences();
      if (preferences?.migration_completed) {
        return { success: true }; // Already migrated
      }

      // Get existing data from localStorage
      const existingSessions = localStorage.getItem('chatSessions');
      if (!existingSessions) {
        // Mark migration as completed even if there was nothing to migrate
        await this.setMigrationCompleted();
        return { success: true }; // Nothing to migrate
      }

      const sessions: ChatSession[] = JSON.parse(existingSessions);
      
      for (const session of sessions) {
        // Create conversation with better title handling
        const title = session.title === "New Chat" && session.messages.length > 1 ? 
          session.messages.find(m => m.role === "user")?.content.split(" ").slice(0, 5).join(" ") + "..." || "New Chat" :
          session.title;
          
        const { data: conversation, error: convError } = await this.createConversation(title);
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

      // Mark migration as completed
      await this.setMigrationCompleted();

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