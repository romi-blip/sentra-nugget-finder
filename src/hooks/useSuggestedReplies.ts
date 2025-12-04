import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useSuggestedReplies() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateReply = useMutation({
    mutationFn: async ({ 
      replyId, 
      editedReply, 
      status 
    }: { 
      replyId: string; 
      editedReply?: string; 
      status?: string;
    }) => {
      const updates: any = {};
      if (editedReply !== undefined) updates.edited_reply = editedReply;
      if (status) updates.status = status;
      if (status === 'posted') updates.posted_at = new Date().toISOString();

      const { error } = await supabase
        .from('suggested_replies')
        .update(updates)
        .eq('id', replyId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-posts'] });
      toast({
        title: "Reply updated",
        description: "Reply status updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update reply",
        variant: "destructive",
      });
    },
  });

  const updateReplyProfile = useMutation({
    mutationFn: async ({ 
      replyId, 
      profileId 
    }: { 
      replyId: string; 
      profileId: string | null;
    }) => {
      const { error } = await supabase
        .from('suggested_replies')
        .update({ suggested_profile_id: profileId })
        .eq('id', replyId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-posts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update reply profile",
        variant: "destructive",
      });
    },
  });

  return {
    updateReply,
    updateReplyProfile,
  };
}
