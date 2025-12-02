-- Enable Row Level Security on data_breach_articles
ALTER TABLE public.data_breach_articles ENABLE ROW LEVEL SECURITY;

-- Create admin-only policy for all operations
CREATE POLICY "Admins can manage data breach articles"
ON public.data_breach_articles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));