-- Extend the app_role enum to include super_admin
ALTER TYPE app_role ADD VALUE 'super_admin';

-- Create global webhooks table for centralized webhook management
CREATE TABLE public.global_webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  type text NOT NULL, -- 'chat', 'file_upload', 'google_drive'
  enabled boolean NOT NULL DEFAULT true,
  timeout integer NOT NULL DEFAULT 120000,
  retry_attempts integer NOT NULL DEFAULT 2,
  headers jsonb DEFAULT '{}',
  last_tested timestamp with time zone,
  last_used timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on global_webhooks
ALTER TABLE public.global_webhooks ENABLE ROW LEVEL SECURITY;

-- Only super_admins can manage global webhooks
CREATE POLICY "Super admins can manage global webhooks" 
ON public.global_webhooks 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Everyone can read global webhooks (for using them in the app)
CREATE POLICY "Users can read global webhooks" 
ON public.global_webhooks 
FOR SELECT 
USING (true);

-- Add updated_at trigger for global_webhooks
CREATE TRIGGER update_global_webhooks_updated_at
BEFORE UPDATE ON public.global_webhooks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update Ilan's role to super_admin (assuming email is ilan@sentra.io)
UPDATE public.user_roles 
SET role = 'super_admin'::app_role 
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'ilan@sentra.io'
);

-- If Ilan doesn't have a role yet, insert one
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role 
FROM auth.users 
WHERE email = 'ilan@sentra.io' 
AND id NOT IN (SELECT user_id FROM public.user_roles);

-- Add RLS policies to restrict KB data access
-- Update knowledge_files to only allow admins and super_admins
DROP POLICY IF EXISTS "Users can view their own knowledge files" ON public.knowledge_files;
DROP POLICY IF EXISTS "Users can create their own knowledge files" ON public.knowledge_files;
DROP POLICY IF EXISTS "Users can update their own knowledge files" ON public.knowledge_files;
DROP POLICY IF EXISTS "Users can delete their own knowledge files" ON public.knowledge_files;

CREATE POLICY "Admins and super_admins can manage knowledge files" 
ON public.knowledge_files 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update website_pages policies (already have admin access)
-- Update documents_website policies (already have admin access)

-- Insert default webhook configurations into global_webhooks
INSERT INTO public.global_webhooks (name, url, type, enabled, timeout, retry_attempts)
VALUES 
  ('Chat Assistant', '', 'chat', true, 120000, 2),
  ('File Upload Processor', '', 'file_upload', true, 60000, 3),
  ('Google Drive Sync', '', 'google_drive', true, 45000, 2)
ON CONFLICT DO NOTHING;