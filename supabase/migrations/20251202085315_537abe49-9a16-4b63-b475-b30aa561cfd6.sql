-- Create tracked_keywords table
CREATE TABLE IF NOT EXISTS public.tracked_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  keyword TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  fetch_frequency_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add keyword_id to reddit_posts table
ALTER TABLE public.reddit_posts 
  ADD COLUMN IF NOT EXISTS keyword_id UUID REFERENCES public.tracked_keywords(id) ON DELETE SET NULL;

-- Make subreddit_id nullable (posts can come from keywords OR subreddits)
ALTER TABLE public.reddit_posts 
  ALTER COLUMN subreddit_id DROP NOT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_reddit_posts_keyword_id ON public.reddit_posts(keyword_id);

-- Enable RLS on tracked_keywords
ALTER TABLE public.tracked_keywords ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tracked_keywords
CREATE POLICY "Users can view their own keywords" 
  ON public.tracked_keywords 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create keywords" 
  ON public.tracked_keywords 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own keywords" 
  ON public.tracked_keywords 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own keywords" 
  ON public.tracked_keywords 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Admins can manage all keywords
CREATE POLICY "Admins can manage all keywords" 
  ON public.tracked_keywords 
  FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update trigger for tracked_keywords
CREATE TRIGGER update_tracked_keywords_updated_at
  BEFORE UPDATE ON public.tracked_keywords
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();