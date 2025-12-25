-- Create brand_settings table for storing brand configuration
CREATE TABLE public.brand_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Sentra 2026 Brand',
  
  -- Colors (stored as hex)
  primary_color TEXT NOT NULL DEFAULT '#39FF14',
  secondary_color TEXT NOT NULL DEFAULT '#FF7F00',
  accent_pink TEXT NOT NULL DEFAULT '#FF00FF',
  accent_cyan TEXT NOT NULL DEFAULT '#00FFFF',
  background_color TEXT NOT NULL DEFAULT '#000000',
  text_color TEXT NOT NULL DEFAULT '#FFFFFF',
  
  -- Fonts
  heading_font TEXT NOT NULL DEFAULT 'Poppins',
  heading_weight TEXT NOT NULL DEFAULT '600',
  body_font TEXT NOT NULL DEFAULT 'Poppins',
  body_weight TEXT NOT NULL DEFAULT '400',
  
  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read brand settings" 
ON public.brand_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage brand settings" 
ON public.brand_settings 
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Insert default brand settings
INSERT INTO public.brand_settings (name, is_active) VALUES ('Sentra 2026 Brand', true);

-- Add updated_at trigger
CREATE TRIGGER update_brand_settings_updated_at
BEFORE UPDATE ON public.brand_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();