-- Add svg_content column to store original SVG code
ALTER TABLE public.element_templates 
ADD COLUMN svg_content TEXT;