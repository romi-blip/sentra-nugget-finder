-- Create document_profiles table for global document settings
CREATE TABLE public.document_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  page_margin_top INTEGER DEFAULT 72,
  page_margin_bottom INTEGER DEFAULT 72,
  page_margin_left INTEGER DEFAULT 72,
  page_margin_right INTEGER DEFAULT 72,
  default_line_height NUMERIC DEFAULT 1.5,
  paragraph_spacing INTEGER DEFAULT 12,
  page_break_before_h1 BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create page_layouts table for element assignments per page type
CREATE TABLE public.page_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.document_profiles(id) ON DELETE CASCADE,
  page_type TEXT NOT NULL CHECK (page_type IN ('cover', 'toc', 'content')),
  background_element_id UUID REFERENCES public.element_templates(id) ON DELETE SET NULL,
  header_element_id UUID REFERENCES public.element_templates(id) ON DELETE SET NULL,
  footer_element_id UUID REFERENCES public.element_templates(id) ON DELETE SET NULL,
  show_logo BOOLEAN DEFAULT true,
  logo_element_id UUID REFERENCES public.element_templates(id) ON DELETE SET NULL,
  logo_position_x INTEGER DEFAULT 50,
  logo_position_y INTEGER DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(profile_id, page_type)
);

-- Create page_text_styles table for context-aware text styles
CREATE TABLE public.page_text_styles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_layout_id UUID NOT NULL REFERENCES public.page_layouts(id) ON DELETE CASCADE,
  context TEXT NOT NULL CHECK (context IN ('title', 'subtitle', 'h1', 'h2', 'h3', 'paragraph', 'bullet', 'toc_entry', 'toc_title')),
  element_template_id UUID REFERENCES public.element_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(page_layout_id, context)
);

-- Enable RLS on all tables
ALTER TABLE public.document_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_text_styles ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_profiles
CREATE POLICY "Authenticated users can view document profiles"
ON public.document_profiles FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create document profiles"
ON public.document_profiles FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update document profiles"
ON public.document_profiles FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete document profiles"
ON public.document_profiles FOR DELETE
USING (auth.role() = 'authenticated');

-- RLS policies for page_layouts
CREATE POLICY "Authenticated users can view page layouts"
ON public.page_layouts FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create page layouts"
ON public.page_layouts FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update page layouts"
ON public.page_layouts FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete page layouts"
ON public.page_layouts FOR DELETE
USING (auth.role() = 'authenticated');

-- RLS policies for page_text_styles
CREATE POLICY "Authenticated users can view page text styles"
ON public.page_text_styles FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create page text styles"
ON public.page_text_styles FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update page text styles"
ON public.page_text_styles FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete page text styles"
ON public.page_text_styles FOR DELETE
USING (auth.role() = 'authenticated');

-- Create indexes for performance
CREATE INDEX idx_page_layouts_profile_id ON public.page_layouts(profile_id);
CREATE INDEX idx_page_text_styles_layout_id ON public.page_text_styles(page_layout_id);

-- Insert a default document profile
INSERT INTO public.document_profiles (name, description, is_default)
VALUES ('Default Sentra Profile', 'Standard Sentra brand document profile', true);