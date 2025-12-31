-- Create llm_ranking_prompts table for storing prompts used in LLM ranking queries
CREATE TABLE public.llm_ranking_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  prompt_text TEXT NOT NULL,
  category VARCHAR(100), -- 'DSPM', 'Data Security', 'Cloud Security', 'AI Security', 'General'
  is_active BOOLEAN DEFAULT true,
  run_frequency VARCHAR(50) DEFAULT 'daily', -- 'daily', 'weekly', 'manual'
  last_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.llm_ranking_prompts ENABLE ROW LEVEL SECURITY;

-- Policy for viewing prompts (admin, super_admin, marketing)
CREATE POLICY "Authorized users can view prompts" ON public.llm_ranking_prompts
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'marketing'::app_role)
  );

-- Policy for managing prompts (admin, super_admin only)
CREATE POLICY "Admin users can manage prompts" ON public.llm_ranking_prompts
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Create trigger for updating updated_at
CREATE TRIGGER update_llm_ranking_prompts_updated_at
  BEFORE UPDATE ON public.llm_ranking_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();