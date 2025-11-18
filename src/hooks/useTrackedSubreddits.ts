import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TrackedSubreddit {
  id: string;
  user_id: string;
  subreddit_name: string;
  rss_url: string;
  is_active: boolean;
  last_fetched_at: string | null;
  fetch_frequency_minutes: number;
  created_at: string;
  updated_at: string;
}

export function useTrackedSubreddits() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: subreddits, isLoading } = useQuery({
    queryKey: ['tracked-subreddits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tracked_subreddits')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as TrackedSubreddit[];
    },
  });

  const addSubreddit = useMutation({
    mutationFn: async (subredditName: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const rssUrl = `https://www.reddit.com/r/${subredditName}/new/.rss`;
      const { data, error } = await supabase
        .from('tracked_subreddits')
        .insert([{
          subreddit_name: subredditName,
          rss_url: rssUrl,
          user_id: user.id
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Trigger immediate fetch for this subreddit
      try {
        await supabase.functions.invoke('fetch-reddit-posts', {
          body: { subreddit_id: data.id }
        });
      } catch (fetchError) {
        console.error('Error triggering fetch:', fetchError);
        // Don't fail the whole operation if fetch fails
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-subreddits'] });
      toast({
        title: "Subreddit added",
        description: "Successfully tracking new subreddit.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add subreddit",
        variant: "destructive",
      });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('tracked_subreddits')
        .update({ is_active: isActive })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-subreddits'] });
    },
  });

  const removeSubreddit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tracked_subreddits')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-subreddits'] });
      toast({
        title: "Subreddit removed",
        description: "Subreddit untracked successfully.",
      });
    },
  });

  return {
    subreddits: subreddits || [],
    isLoading,
    addSubreddit,
    toggleActive,
    removeSubreddit,
  };
}
