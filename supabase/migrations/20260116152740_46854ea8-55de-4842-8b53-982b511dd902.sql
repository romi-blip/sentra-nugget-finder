-- Footer configuration columns for page_layouts
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_show_separator BOOLEAN DEFAULT false;
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_separator_color TEXT DEFAULT '#CCCCCC';
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_separator_thickness INTEGER DEFAULT 1;

-- Left section
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_left_type TEXT DEFAULT 'none';
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_left_text TEXT;
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_left_image_base64 TEXT;
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_left_image_mime TEXT;

-- Middle section
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_middle_type TEXT DEFAULT 'none';
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_middle_text TEXT;
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_middle_image_base64 TEXT;
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_middle_image_mime TEXT;

-- Right section
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_right_type TEXT DEFAULT 'none';
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_right_text TEXT;
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_right_image_base64 TEXT;
ALTER TABLE page_layouts ADD COLUMN IF NOT EXISTS footer_right_image_mime TEXT;