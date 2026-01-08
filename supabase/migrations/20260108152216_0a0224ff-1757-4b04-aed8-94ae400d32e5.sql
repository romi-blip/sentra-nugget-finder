-- Create element_templates table for element-based document design
CREATE TABLE public.element_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  element_type TEXT NOT NULL CHECK (element_type IN (
    'header', 'footer', 'cover_background', 
    'title', 'subtitle', 'h1', 'h2', 'h3',
    'paragraph', 'bullet', 'toc_entry', 
    'image_container', 'page_number'
  )),
  
  -- For visual elements (header, footer, cover) - store as PNG
  image_base64 TEXT,
  image_height INTEGER,
  image_width INTEGER,
  
  -- For text styles
  font_family TEXT DEFAULT 'Helvetica',
  font_size INTEGER,
  font_weight TEXT DEFAULT 'normal',
  font_color TEXT DEFAULT '#000000',
  line_height DECIMAL DEFAULT 1.5,
  margin_top INTEGER DEFAULT 0,
  margin_bottom INTEGER DEFAULT 0,
  margin_left INTEGER DEFAULT 0,
  text_align TEXT DEFAULT 'left',
  
  -- For bullets
  bullet_character TEXT DEFAULT '•',
  bullet_indent INTEGER DEFAULT 20,
  
  -- Positioning for visual elements
  position_x INTEGER,
  position_y INTEGER,
  
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS
ALTER TABLE public.element_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view element templates" ON public.element_templates
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert element templates" ON public.element_templates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update element templates" ON public.element_templates
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete element templates" ON public.element_templates
  FOR DELETE USING (auth.role() = 'authenticated');

-- Insert default text style elements
INSERT INTO public.element_templates (name, element_type, font_size, font_weight, font_color, margin_top, margin_bottom, is_default)
VALUES 
  ('Default Title', 'title', 28, 'bold', '#1a1a2e', 0, 20, true),
  ('Default H1', 'h1', 22, 'bold', '#1a1a2e', 20, 12, true),
  ('Default H2', 'h2', 16, 'bold', '#1a1a2e', 16, 8, true),
  ('Default H3', 'h3', 13, 'bold', '#1a1a2e', 12, 6, true),
  ('Default Paragraph', 'paragraph', 10, 'normal', '#333333', 0, 8, true),
  ('Default Bullet', 'bullet', 10, 'normal', '#333333', 0, 4, true);