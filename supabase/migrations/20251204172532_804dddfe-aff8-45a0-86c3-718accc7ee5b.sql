-- Add suggested_profile_id to suggested_replies table
ALTER TABLE public.suggested_replies
ADD COLUMN suggested_profile_id uuid REFERENCES public.reddit_profiles(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_suggested_replies_profile ON public.suggested_replies(suggested_profile_id);