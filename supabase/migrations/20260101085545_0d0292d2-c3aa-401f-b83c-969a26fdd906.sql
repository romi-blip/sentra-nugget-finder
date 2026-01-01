-- Add scheduling columns to llm_ranking_prompts
ALTER TABLE public.llm_ranking_prompts
ADD COLUMN IF NOT EXISTS schedule_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS next_scheduled_run timestamp with time zone,
ADD COLUMN IF NOT EXISTS scheduled_time time DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS schedule_days text[] DEFAULT '{}';

-- Create global scheduler settings table
CREATE TABLE IF NOT EXISTS public.llm_ranking_scheduler_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduler_enabled boolean NOT NULL DEFAULT true,
  default_run_time time NOT NULL DEFAULT '09:00:00',
  last_run_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.llm_ranking_scheduler_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheduler settings
CREATE POLICY "Admin users can manage scheduler settings"
ON public.llm_ranking_scheduler_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authorized users can view scheduler settings"
ON public.llm_ranking_scheduler_settings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'marketing'::app_role));

-- Insert default settings row if not exists
INSERT INTO public.llm_ranking_scheduler_settings (scheduler_enabled, default_run_time)
SELECT true, '09:00:00'::time
WHERE NOT EXISTS (SELECT 1 FROM public.llm_ranking_scheduler_settings);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_llm_ranking_scheduler_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_llm_ranking_scheduler_settings_updated_at ON public.llm_ranking_scheduler_settings;
CREATE TRIGGER update_llm_ranking_scheduler_settings_updated_at
BEFORE UPDATE ON public.llm_ranking_scheduler_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_llm_ranking_scheduler_settings_updated_at();