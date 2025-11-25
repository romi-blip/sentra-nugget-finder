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
  upvotes: number | null;
}

interface UseRedditPostsOptions {
  subredditIds?: string[];
  priority?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function useRedditPosts(options: UseRedditPostsOptions = {}) {
  const { data: postsData, isLoading } = useQuery({
    queryKey: ['reddit-posts', options],
    queryFn: async () => {
      const page = options.page || 1;
      const pageSize = options.pageSize || 25;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('reddit_posts')
        .select(`
          *,
          post_reviews (*),
          suggested_replies (*)
        `, { count: 'exact' })
        .order('pub_date', { ascending: false })
        .range(from, to);

      if (options.subredditIds && options.subredditIds.length > 0) {
        query = query.in('subreddit_id', options.subredditIds);
      }

      const { data, error, count } = await query;
      
      if (error) throw error;
      
      // Filter by priority and status if needed
      let filteredData = data;
      
      // Normalize review to handle both object and array responses
      if (options.priority && options.priority !== 'all') {
        filteredData = filteredData.filter((post: any) => {
          const review = post.post_reviews
            ? (Array.isArray(post.post_reviews) ? post.post_reviews[0] : post.post_reviews)
            : null;
          return review?.recommendation === options.priority;
        });
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
        } else if (options.status === 'high_engagement') {
          filteredData = filteredData.filter((post: any) => 
            post.comment_count >= 50
          );
        }
      }
      
      return {
        posts: filteredData,
        totalCount: count || 0
      };
    },
  });

  return {
    posts: postsData?.posts || [],
    totalCount: postsData?.totalCount || 0,
    isLoading,
  };
}
