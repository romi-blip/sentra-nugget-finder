-- Allow users to delete posts from their tracked subreddits
CREATE POLICY "Users can delete posts from their subreddits" 
ON public.reddit_posts 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM tracked_subreddits
    WHERE tracked_subreddits.id = reddit_posts.subreddit_id 
    AND tracked_subreddits.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM tracked_keywords
    WHERE tracked_keywords.id = reddit_posts.keyword_id 
    AND tracked_keywords.user_id = auth.uid()
  )
);

-- Allow admins to delete any posts
CREATE POLICY "Admins can delete all posts" 
ON public.reddit_posts 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);