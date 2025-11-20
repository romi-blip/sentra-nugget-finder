-- Add comment tracking columns to reddit_posts table
ALTER TABLE reddit_posts 
ADD COLUMN IF NOT EXISTS comment_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments_fetched_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS top_comments jsonb DEFAULT '[]'::jsonb;

-- Add comment fetching preference to tracked_subreddits
ALTER TABLE tracked_subreddits 
ADD COLUMN IF NOT EXISTS fetch_comments boolean DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_reddit_posts_comment_count ON reddit_posts(comment_count DESC);

COMMENT ON COLUMN reddit_posts.comment_count IS 'Total number of comments on the Reddit post';
COMMENT ON COLUMN reddit_posts.comments_fetched_at IS 'Last time comments were fetched from Reddit';
COMMENT ON COLUMN reddit_posts.top_comments IS 'Array of top 5-10 comments with author, body, score, and timestamp';
COMMENT ON COLUMN tracked_subreddits.fetch_comments IS 'Whether to automatically fetch comments when fetching new posts';