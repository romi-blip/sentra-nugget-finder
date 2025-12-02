import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TrackedKeyword {
  id: string;
  user_id: string;
  keyword: string;
  is_active: boolean;
  last_fetched_at: string | null;
  fetch_frequency_minutes: number;
  negative_keywords: string[];
  search_comments: boolean;
  created_at: string;
  updated_at: string;
}

export function useTrackedKeywords() {
  const queryClient = useQueryClient();

  const { data: keywords = [], isLoading } = useQuery({
    queryKey: ['tracked-keywords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tracked_keywords')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TrackedKeyword[];
    },
  });

  const addKeyword = useMutation({
    mutationFn: async (keyword: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('tracked_keywords')
        .insert({
          keyword,
          user_id: user.id,
          is_active: true,
          negative_keywords: [],
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger immediate fetch for this keyword
      const { error: fetchError } = await supabase.functions.invoke('fetch-keyword-posts');
      if (fetchError) {
        console.error('Error triggering keyword fetch:', fetchError);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-keywords'] });
      queryClient.invalidateQueries({ queryKey: ['reddit-posts'] });
      toast.success('Keyword added and posts are being fetched');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add keyword: ${error.message}`);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('tracked_keywords')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-keywords'] });
    },
  });

  const updateNegativeKeywords = useMutation({
    mutationFn: async ({ id, negativeKeywords }: { id: string; negativeKeywords: string[] }) => {
      const { error } = await supabase
        .from('tracked_keywords')
        .update({ negative_keywords: negativeKeywords })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-keywords'] });
      toast.success('Negative keywords updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update negative keywords: ${error.message}`);
    },
  });

  const removeKeyword = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tracked_keywords')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-keywords'] });
      toast.success('Keyword removed');
    },
  });

  const toggleCommentSearch = useMutation({
    mutationFn: async ({ id, searchComments }: { id: string; searchComments: boolean }) => {
      const { error } = await supabase
        .from('tracked_keywords')
        .update({ search_comments: searchComments })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-keywords'] });
      toast.success('Comment search setting updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update comment search: ${error.message}`);
    },
  });

  const refreshCommentSearch = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-keyword-comments');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tracked-keywords'] });
      queryClient.invalidateQueries({ queryKey: ['reddit-posts'] });
      toast.success(`Comment search complete: ${data?.totalNewPosts || 0} new posts found`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to search comments: ${error.message}`);
    },
  });

  return {
    keywords,
    isLoading,
    addKeyword,
    toggleActive,
    updateNegativeKeywords,
    removeKeyword,
    toggleCommentSearch,
    refreshCommentSearch,
  };
}
