import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useRedditComments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchComments = useMutation({
    mutationFn: async ({ postId, subredditId }: { postId?: string; subredditId?: string }) => {
      const { data, error } = await supabase.functions.invoke('fetch-reddit-comments', {
        body: { 
          post_id: postId,
          subreddit_id: subredditId
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reddit-posts'] });
      const successCount = data?.results?.filter((r: any) => r.status === 'success').length || 0;
      toast({
        title: "Comments fetched",
        description: `Successfully fetched comments for ${successCount} post${successCount !== 1 ? 's' : ''}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error fetching comments",
        description: error.message || "Failed to fetch comments",
        variant: "destructive",
      });
    },
  });

  return {
    fetchComments,
  };
}
