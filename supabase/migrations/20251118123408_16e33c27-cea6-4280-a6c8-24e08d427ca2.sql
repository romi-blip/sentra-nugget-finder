-- Create tracked_subreddits table
CREATE TABLE tracked_subreddits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subreddit_name TEXT NOT NULL,
  rss_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  fetch_frequency_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, subreddit_name)
);

CREATE INDEX idx_tracked_subreddits_user_id ON tracked_subreddits(user_id);
CREATE INDEX idx_tracked_subreddits_active ON tracked_subreddits(is_active) WHERE is_active = true;

-- RLS policies for tracked_subreddits
ALTER TABLE tracked_subreddits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subreddits"
ON tracked_subreddits
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subreddits"
ON tracked_subreddits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subreddits"
ON tracked_subreddits
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subreddits"
ON tracked_subreddits
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subreddits"
ON tracked_subreddits
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Create reddit_posts table
CREATE TABLE reddit_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subreddit_id UUID NOT NULL REFERENCES tracked_subreddits(id) ON DELETE CASCADE,
  reddit_id TEXT NOT NULL,
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  author TEXT,
  content TEXT,
  content_snippet TEXT,
  pub_date TIMESTAMPTZ,
  iso_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reddit_id)
);

CREATE INDEX idx_reddit_posts_subreddit_id ON reddit_posts(subreddit_id);
CREATE INDEX idx_reddit_posts_reddit_id ON reddit_posts(reddit_id);
CREATE INDEX idx_reddit_posts_pub_date ON reddit_posts(pub_date DESC);

-- RLS policies for reddit_posts
ALTER TABLE reddit_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view posts from their subreddits"
ON reddit_posts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tracked_subreddits
    WHERE tracked_subreddits.id = reddit_posts.subreddit_id
    AND tracked_subreddits.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all posts"
ON reddit_posts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Create post_reviews table
CREATE TABLE post_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES reddit_posts(id) ON DELETE CASCADE,
  relevance_score INTEGER CHECK (relevance_score >= 0 AND relevance_score <= 100),
  recommendation TEXT CHECK (recommendation IN ('high_priority', 'medium_priority', 'low_priority', 'skip')),
  reasoning TEXT,
  problem_fit_score INTEGER CHECK (problem_fit_score >= 0 AND problem_fit_score <= 100),
  audience_quality_score INTEGER CHECK (audience_quality_score >= 0 AND audience_quality_score <= 100),
  engagement_potential_score INTEGER CHECK (engagement_potential_score >= 0 AND engagement_potential_score <= 100),
  timing_score INTEGER CHECK (timing_score >= 0 AND timing_score <= 100),
  strategic_value_score INTEGER CHECK (strategic_value_score >= 0 AND strategic_value_score <= 100),
  key_themes TEXT,
  sentra_angles TEXT,
  engagement_approach TEXT,
  suggested_tone TEXT,
  risk_flags TEXT,
  estimated_effort TEXT CHECK (estimated_effort IN ('low', 'medium', 'high')),
  subreddit_context TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id)
);

CREATE INDEX idx_post_reviews_post_id ON post_reviews(post_id);
CREATE INDEX idx_post_reviews_recommendation ON post_reviews(recommendation);
CREATE INDEX idx_post_reviews_relevance_score ON post_reviews(relevance_score DESC);

-- RLS policies for post_reviews
ALTER TABLE post_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reviews for their posts"
ON post_reviews
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM reddit_posts
    JOIN tracked_subreddits ON tracked_subreddits.id = reddit_posts.subreddit_id
    WHERE reddit_posts.id = post_reviews.post_id
    AND tracked_subreddits.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all reviews"
ON post_reviews
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Create suggested_replies table
CREATE TABLE suggested_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES reddit_posts(id) ON DELETE CASCADE,
  review_id UUID REFERENCES post_reviews(id) ON DELETE SET NULL,
  suggested_reply TEXT NOT NULL,
  edited_reply TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'posted', 'rejected', 'editing')),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_suggested_replies_post_id ON suggested_replies(post_id);
CREATE INDEX idx_suggested_replies_status ON suggested_replies(status);
CREATE INDEX idx_suggested_replies_posted_by ON suggested_replies(posted_by);

-- RLS policies for suggested_replies
ALTER TABLE suggested_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view replies for their posts"
ON suggested_replies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM reddit_posts
    JOIN tracked_subreddits ON tracked_subreddits.id = reddit_posts.subreddit_id
    WHERE reddit_posts.id = suggested_replies.post_id
    AND tracked_subreddits.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update replies for their posts"
ON suggested_replies
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM reddit_posts
    JOIN tracked_subreddits ON tracked_subreddits.id = reddit_posts.subreddit_id
    WHERE reddit_posts.id = suggested_replies.post_id
    AND tracked_subreddits.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all replies"
ON suggested_replies
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_tracked_subreddits_updated_at
BEFORE UPDATE ON tracked_subreddits
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reddit_posts_updated_at
BEFORE UPDATE ON reddit_posts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_reviews_updated_at
BEFORE UPDATE ON post_reviews
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suggested_replies_updated_at
BEFORE UPDATE ON suggested_replies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();