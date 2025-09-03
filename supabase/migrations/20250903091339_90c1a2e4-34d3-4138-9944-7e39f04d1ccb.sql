-- Update the status check constraint to include 'running' status
ALTER TABLE lead_processing_jobs 
DROP CONSTRAINT lead_processing_jobs_status_check;

ALTER TABLE lead_processing_jobs 
ADD CONSTRAINT lead_processing_jobs_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'processing'::text, 'completed'::text, 'failed'::text]));