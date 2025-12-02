import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RedditPost {
  id: string;
  subreddit_id: string | null;
  keyword_id: string | null;
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
  comment_count: number | null;
  comments_fetched_at: string | null;
  top_comments: any | null;
}

interface UseRedditPostsOptions {
  subredditIds?: string[];
  keywordIds?: string[];
  priority?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function useRedditPosts(options: UseRedditPostsOptions = {}) {
  const { data: postsData, isLoading } = useQuery<{
    posts: RedditPost[];
    totalCount: number;
  }>({
    queryKey: ['reddit-posts', options],
    queryFn: async () => {
      const page = options.page || 1;
      const pageSize = options.pageSize || 25;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Build base query with appropriate joins based on filters
      let selectClause = `
        *,
        post_reviews (*),
        suggested_replies (*)
      `;

      // Use inner join for priority filter to exclude posts without matching reviews
      if (options.priority && options.priority !== 'all') {
        selectClause = `
          *,
          post_reviews!inner (*),
          suggested_replies (*)
        `;
      }

      let query = supabase
        .from('reddit_posts')
        .select(selectClause, { count: 'exact' })
        .order('pub_date', { ascending: false });

      // Apply subreddit filter
      if (options.subredditIds && options.subredditIds.length > 0) {
        query = query.in('subreddit_id', options.subredditIds);
      }

      // Apply keyword filter
      if (options.keywordIds && options.keywordIds.length > 0) {
        query = query.in('keyword_id', options.keywordIds);
      }

      // Apply priority filter at database level
      if (options.priority && options.priority !== 'all') {
        query = query.eq('post_reviews.recommendation', options.priority);
      }

      // Apply status filters at database level where possible
      if (options.status) {
        if (options.status === 'high_engagement') {
          query = query.gte('comment_count', 50);
        }
        // Note: no_reply, has_reply, and posted filters need client-side handling
        // due to complex relationship logic with suggested_replies
      }

      // Apply pagination after all filters
      query = query.range(from, to);

      const { data, error, count } = await query;
      
      if (error) throw error;
      
      // Cast data to proper type (using unknown as intermediate to satisfy TypeScript)
      const typedData = (data || []) as unknown as RedditPost[];
      
      // Apply remaining client-side filters for complex reply logic
      let filteredData = typedData;
      
      if (options.status && options.status !== 'high_engagement') {
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
