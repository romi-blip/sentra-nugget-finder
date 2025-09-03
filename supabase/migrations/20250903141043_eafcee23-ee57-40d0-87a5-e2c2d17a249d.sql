-- Add new ownership and Salesforce status fields to event_leads table
ALTER TABLE public.event_leads 
ADD COLUMN manual_owner_email text,
ADD COLUMN sf_existing_customer boolean DEFAULT false,
ADD COLUMN sf_existing_opportunity boolean DEFAULT false,
ADD COLUMN salesforce_account_sdr_owner_email text;