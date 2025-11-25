-- Add upvotes column to reddit_posts table
ALTER TABLE reddit_posts 
ADD COLUMN upvotes integer DEFAULT 0;