-- Add cover page title styling configuration to page_layouts
ALTER TABLE public.page_layouts
ADD COLUMN cover_title_highlight_words integer NOT NULL DEFAULT 3,
ADD COLUMN cover_title_highlight_color text DEFAULT '#39FF14',
ADD COLUMN cover_title_text_color text DEFAULT '#FFFFFF',
ADD COLUMN cover_title_y_offset integer NOT NULL DEFAULT 100;