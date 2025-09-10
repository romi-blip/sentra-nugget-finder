-- Add email validation columns to event_leads table
ALTER TABLE public.event_leads 
ADD COLUMN email_validation_status text DEFAULT 'pending',
ADD COLUMN email_validation_result jsonb DEFAULT NULL,
ADD COLUMN email_validation_score integer DEFAULT NULL,
ADD COLUMN email_validation_reason text DEFAULT NULL;

-- Add index for efficient querying
CREATE INDEX idx_event_leads_email_validation_status 
ON public.event_leads (event_id, email_validation_status);