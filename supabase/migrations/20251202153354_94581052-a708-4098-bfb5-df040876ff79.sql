-- Add search_comments boolean to tracked_keywords table
ALTER TABLE public.tracked_keywords 
ADD COLUMN search_comments boolean DEFAULT false;

-- Add source_type to reddit_posts table to distinguish post vs comment sources
ALTER TABLE public.reddit_posts 
ADD COLUMN source_type text DEFAULT 'post';

-- Add comment for documentation
COMMENT ON COLUMN public.tracked_keywords.search_comments IS 'When enabled, keyword search will also search in Reddit comments';
COMMENT ON COLUMN public.reddit_posts.source_type IS 'Source of the post: post (from subreddit/keyword post search) or comment (found via keyword comment search)';