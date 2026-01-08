-- Add image_base64 column to store pre-rendered PNG versions of templates
ALTER TABLE public.document_templates 
ADD COLUMN IF NOT EXISTS image_base64 TEXT;