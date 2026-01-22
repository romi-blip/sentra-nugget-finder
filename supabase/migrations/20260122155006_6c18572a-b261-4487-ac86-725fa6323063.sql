-- Add confidential marking option for cover page
ALTER TABLE public.page_layouts 
ADD COLUMN IF NOT EXISTS show_confidential boolean DEFAULT false;