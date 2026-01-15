-- Add logo_height column to page_layouts for configurable logo display size
ALTER TABLE public.page_layouts 
ADD COLUMN logo_height integer DEFAULT 32;

-- Add a comment to explain the column
COMMENT ON COLUMN public.page_layouts.logo_height IS 'Target display height for the logo in PDF points (default 32)';