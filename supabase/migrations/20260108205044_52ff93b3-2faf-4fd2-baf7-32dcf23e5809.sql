-- Drop the existing check constraint and recreate with 'logo' included
ALTER TABLE public.element_templates DROP CONSTRAINT IF EXISTS element_templates_element_type_check;

ALTER TABLE public.element_templates ADD CONSTRAINT element_templates_element_type_check 
CHECK (element_type IN ('header', 'footer', 'cover_background', 'logo', 'title', 'subtitle', 'h1', 'h2', 'h3', 'paragraph', 'bullet', 'toc_entry', 'image_container', 'page_number'));