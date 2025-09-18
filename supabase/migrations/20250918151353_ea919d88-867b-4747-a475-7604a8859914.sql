-- Add detailed progress tracking columns to lead_processing_jobs table
ALTER TABLE lead_processing_jobs 
ADD COLUMN current_stage TEXT,
ADD COLUMN stage_progress INTEGER DEFAULT 0,
ADD COLUMN estimated_completion_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN stage_description TEXT;