import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RedditPost {
  id: string;
  subreddit_id: string;
  reddit_id: string;
  title: string;
  link: string;
  author: string | null;
  content: string | null;
  content_snippet: string | null;
  pub_date: string | null;
  iso_date: string | null;
  created_at: string;
  updated_at: string;
}

interface UseRedditPostsOptions {
  subredditIds?: string[];
  priority?: string;
  status?: string;
}

export function useRedditPosts(options: UseRedditPostsOptions = {}) {
  const { data: posts, isLoading } = useQuery({
    queryKey: ['reddit-posts', options],
    queryFn: async () => {
      let query = supabase
        .from('reddit_posts')
        .select(`
          *,
          post_reviews (*),
          suggested_replies (*)
        `)
        .order('pub_date', { ascending: false })
        .limit(50);

      if (options.subredditIds && options.subredditIds.length > 0) {
        query = query.in('subreddit_id', options.subredditIds);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Filter by priority and status if needed
      let filteredData = data;
      
      if (options.priority && options.priority !== 'all') {
        filteredData = filteredData.filter((post: any) => 
          post.post_reviews?.[0]?.recommendation === options.priority
        );
      }
      
      if (options.status) {
        if (options.status === 'no_reply') {
          filteredData = filteredData.filter((post: any) => 
            !post.suggested_replies || post.suggested_replies.length === 0
          );
        } else if (options.status === 'has_reply') {
          filteredData = filteredData.filter((post: any) => 
            post.suggested_replies && post.suggested_replies.length > 0 && 
            post.suggested_replies[0]?.status === 'pending'
          );
        } else if (options.status === 'posted') {
          filteredData = filteredData.filter((post: any) => 
            post.suggested_replies && post.suggested_replies.length > 0 && 
            post.suggested_replies[0]?.status === 'posted'
          );
        }
      }
      
      return filteredData;
    },
  });

  return {
    posts: posts || [],
    isLoading,
  };
}
