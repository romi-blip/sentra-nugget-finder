-- Add content_page_element_id column to page_layouts table
-- This allows using a full-page design instead of composing header+footer separately
ALTER TABLE page_layouts 
ADD COLUMN content_page_element_id UUID REFERENCES element_templates(id);