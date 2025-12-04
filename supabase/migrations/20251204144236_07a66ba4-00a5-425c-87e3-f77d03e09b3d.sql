-- Create reddit_profiles table
CREATE TABLE public.reddit_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reddit_username TEXT NOT NULL,
  display_name TEXT,
  profile_url TEXT,
  avatar_url TEXT,
  link_karma INTEGER DEFAULT 0,
  comment_karma INTEGER DEFAULT 0,
  total_karma INTEGER DEFAULT 0,
  account_created_at TIMESTAMP WITH TIME ZONE,
  is_verified BOOLEAN DEFAULT false,
  is_premium BOOLEAN DEFAULT false,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, reddit_username)
);

-- Create reddit_profile_activity table
CREATE TABLE public.reddit_profile_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.reddit_profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('post', 'comment')),
  reddit_id TEXT NOT NULL,
  subreddit TEXT,
  title TEXT,
  content TEXT,
  permalink TEXT,
  score INTEGER DEFAULT 0,
  num_comments INTEGER DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(profile_id, reddit_id)
);

-- Enable RLS
ALTER TABLE public.reddit_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reddit_profile_activity ENABLE ROW LEVEL SECURITY;

-- RLS policies for reddit_profiles
CREATE POLICY "Users can view their own profiles"
ON public.reddit_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profiles"
ON public.reddit_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profiles"
ON public.reddit_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profiles"
ON public.reddit_profiles FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles"
ON public.reddit_profiles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- RLS policies for reddit_profile_activity
CREATE POLICY "Users can view activity for their profiles"
ON public.reddit_profile_activity FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.reddit_profiles
  WHERE reddit_profiles.id = reddit_profile_activity.profile_id
  AND reddit_profiles.user_id = auth.uid()
));

CREATE POLICY "Admins can manage all activity"
ON public.reddit_profile_activity FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_reddit_profiles_user_id ON public.reddit_profiles(user_id);
CREATE INDEX idx_reddit_profile_activity_profile_id ON public.reddit_profile_activity(profile_id);
CREATE INDEX idx_reddit_profile_activity_posted_at ON public.reddit_profile_activity(posted_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_reddit_profiles_updated_at
BEFORE UPDATE ON public.reddit_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();