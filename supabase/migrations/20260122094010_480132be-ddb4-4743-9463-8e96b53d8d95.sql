-- Add page number format columns to page_layouts table
ALTER TABLE public.page_layouts
ADD COLUMN IF NOT EXISTS footer_left_page_number_format text DEFAULT 'full',
ADD COLUMN IF NOT EXISTS footer_middle_page_number_format text DEFAULT 'full',
ADD COLUMN IF NOT EXISTS footer_right_page_number_format text DEFAULT 'full';

-- Add check constraints to ensure valid values
ALTER TABLE public.page_layouts
ADD CONSTRAINT footer_left_page_number_format_check CHECK (footer_left_page_number_format IN ('full', 'number_only')),
ADD CONSTRAINT footer_middle_page_number_format_check CHECK (footer_middle_page_number_format IN ('full', 'number_only')),
ADD CONSTRAINT footer_right_page_number_format_check CHECK (footer_right_page_number_format IN ('full', 'number_only'));

COMMENT ON COLUMN public.page_layouts.footer_left_page_number_format IS 'Format for left footer page number: full = "Page X of Y", number_only = "X"';
COMMENT ON COLUMN public.page_layouts.footer_middle_page_number_format IS 'Format for middle footer page number: full = "Page X of Y", number_only = "X"';
COMMENT ON COLUMN public.page_layouts.footer_right_page_number_format IS 'Format for right footer page number: full = "Page X of Y", number_only = "X"';