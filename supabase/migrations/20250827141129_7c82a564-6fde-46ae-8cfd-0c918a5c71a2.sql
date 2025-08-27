-- Add salesforce_campaign_url column to events table
ALTER TABLE public.events 
ADD COLUMN salesforce_campaign_url TEXT;