import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useRedditActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const refreshPosts = useMutation({
    mutationFn: async (subredditId?: string) => {
      const { data, error } = await supabase.functions.invoke('fetch-reddit-posts', {
        body: { subreddit_id: subredditId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-posts'] });
      queryClient.invalidateQueries({ queryKey: ['tracked-subreddits'] });
      toast({
        title: "Posts refreshed",
        description: "Successfully fetched latest posts.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh posts",
        variant: "destructive",
      });
    },
  });

  const analyzePost = useMutation({
    mutationFn: async ({ postId, post }: { postId: string; post: any }) => {
      const { data, error } = await supabase.functions.invoke('analyze-reddit-post', {
        body: { post_id: postId, post }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-posts'] });
      toast({
        title: "Post analyzed",
        description: "Successfully analyzed post.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to analyze post",
        variant: "destructive",
      });
    },
  });

  const generateReply = useMutation({
    mutationFn: async ({ postId, reviewId, post, review }: { 
      postId: string; 
      reviewId: string;
      post: any;
      review: any;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-reddit-reply', {
        body: { post_id: postId, review_id: reviewId, post, review }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-posts'] });
      toast({
        title: "Reply generated",
        description: "Successfully generated new reply.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate reply",
        variant: "destructive",
      });
    },
  });

  const refreshKeywordPosts = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-keyword-posts');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reddit-posts'] });
      queryClient.invalidateQueries({ queryKey: ['tracked-keywords'] });
      toast({
        title: "Keyword posts refreshed",
        description: data?.message || "Successfully fetched keyword posts.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh keyword posts",
        variant: "destructive",
      });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from('reddit_posts')
        .delete()
        .eq('id', postId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-posts'] });
      toast({
        title: "Post deleted",
        description: "Successfully deleted the post.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete post",
        variant: "destructive",
      });
    },
  });

  const deletePosts = useMutation({
    mutationFn: async (postIds: string[]) => {
      const { error } = await supabase
        .from('reddit_posts')
        .delete()
        .in('id', postIds);
      
      if (error) throw error;
      return postIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['reddit-posts'] });
      toast({
        title: "Posts deleted",
        description: `Successfully deleted ${count} posts.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete posts",
        variant: "destructive",
      });
    },
  });

  const deleteOldPosts = useMutation({
    mutationFn: async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      
      const { data, error } = await supabase
        .from('reddit_posts')
        .delete()
        .lt('pub_date', cutoffDate.toISOString())
        .select('id');
      
      if (error) throw error;
      return data?.length || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['reddit-posts'] });
      toast({
        title: "Old posts cleaned up",
        description: `Successfully deleted ${count} posts older than 3 months.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete old posts",
        variant: "destructive",
      });
    },
  });

  return {
    refreshPosts,
    analyzePost,
    generateReply,
    refreshKeywordPosts,
    deletePost,
    deletePosts,
    deleteOldPosts,
  };
}
