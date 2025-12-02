-- Add negative_keywords column to tracked_keywords table
ALTER TABLE public.tracked_keywords
ADD COLUMN negative_keywords text[] DEFAULT '{}';

-- Add comment explaining the column
COMMENT ON COLUMN public.tracked_keywords.negative_keywords IS 'Array of keywords to exclude from search results';