-- Add new fields to event_leads table for validation status and results
ALTER TABLE public.event_leads 
ADD COLUMN validation_status text DEFAULT 'pending',
ADD COLUMN validation_errors jsonb DEFAULT '[]'::jsonb,
ADD COLUMN salesforce_status text DEFAULT 'pending',
ADD COLUMN salesforce_account_id text,
ADD COLUMN salesforce_contact_id text,
ADD COLUMN salesforce_owner_id text,
ADD COLUMN salesforce_sdr_owner_id text,
ADD COLUMN enrichment_status text DEFAULT 'pending',
ADD COLUMN zoominfo_phone_1 text,
ADD COLUMN zoominfo_phone_2 text,
ADD COLUMN zoominfo_company_state text,
ADD COLUMN zoominfo_company_country text,
ADD COLUMN sync_status text DEFAULT 'pending',
ADD COLUMN sync_errors jsonb DEFAULT '[]'::jsonb;

-- Create lead processing jobs table to track bulk operations
CREATE TABLE public.lead_processing_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('validate', 'check_salesforce', 'enrich', 'sync')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_leads integer NOT NULL DEFAULT 0,
  processed_leads integer NOT NULL DEFAULT 0,
  failed_leads integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on the new table
ALTER TABLE public.lead_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for lead processing jobs
CREATE POLICY "Admins can manage lead processing jobs"
ON public.lead_processing_jobs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_lead_processing_jobs_updated_at
BEFORE UPDATE ON public.lead_processing_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();