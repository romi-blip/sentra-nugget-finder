-- CRITICAL SECURITY FIXES

-- 1. Fix global_webhooks SELECT policy (currently allows true, should be super_admin only)
DROP POLICY IF EXISTS "Users can read global webhooks" ON global_webhooks;
CREATE POLICY "Only super admins can read global webhooks" 
ON global_webhooks 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Enable RLS and add policies for sensitive tables without RLS
ALTER TABLE breach_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage breach articles" 
ON breach_articles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE breach_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage breach summary" 
ON breach_summary 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage companies" 
ON companies 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage contacts" 
ON contacts 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE high_priority_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage high priority prospects" 
ON high_priority_prospects 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE sales_enablement_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage sales enablement assets" 
ON sales_enablement_assets 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Secure document tables (may be used for knowledge base)
ALTER TABLE documents_competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage competitor documents" 
ON documents_competitors 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE documents_industry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage industry documents" 
ON documents_industry 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE documents_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage news documents" 
ON documents_news 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE documents_sentra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage Sentra documents" 
ON documents_sentra 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 4. Fix search_path on security definer functions
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- 5. Make knowledge-files bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'knowledge-files';