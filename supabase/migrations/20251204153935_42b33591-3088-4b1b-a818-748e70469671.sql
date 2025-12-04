-- Add profile management columns to reddit_profiles
ALTER TABLE public.reddit_profiles 
ADD COLUMN IF NOT EXISTS profile_type text NOT NULL DEFAULT 'tracked',
ADD COLUMN IF NOT EXISTS persona_summary text,
ADD COLUMN IF NOT EXISTS persona_generated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS expertise_areas text[],
ADD COLUMN IF NOT EXISTS writing_style text,
ADD COLUMN IF NOT EXISTS typical_tone text;

-- Add constraint for profile_type values
ALTER TABLE public.reddit_profiles 
ADD CONSTRAINT reddit_profiles_profile_type_check 
CHECK (profile_type IN ('tracked', 'managed'));