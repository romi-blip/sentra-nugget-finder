-- Drop the existing check constraint and add updated one with content_page
ALTER TABLE element_templates DROP CONSTRAINT IF EXISTS element_templates_element_type_check;

ALTER TABLE element_templates ADD CONSTRAINT element_templates_element_type_check 
CHECK (element_type IN ('header', 'footer', 'cover_background', 'logo', 'content_page', 'title', 'subtitle', 'h1', 'h2', 'h3', 'paragraph', 'bullet', 'toc_entry', 'image_container', 'page_number'));