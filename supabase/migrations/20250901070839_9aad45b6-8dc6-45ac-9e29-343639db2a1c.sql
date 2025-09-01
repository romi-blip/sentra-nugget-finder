
-- Add Salesforce status and owner fields to event_leads for N8N-based Salesforce check results

ALTER TABLE public.event_leads
  ADD COLUMN IF NOT EXISTS salesforce_status_detail text,                              -- e.g., 'existing_account_existing_contact'
  ADD COLUMN IF NOT EXISTS sf_existing_account boolean,                                 -- derived from status
  ADD COLUMN IF NOT EXISTS sf_existing_contact boolean,                                 -- derived from status
  ADD COLUMN IF NOT EXISTS sf_existing_lead boolean,                                    -- if N8N checks SF Lead object
  ADD COLUMN IF NOT EXISTS salesforce_lead_id text,                                     -- SF Lead ID if applicable
  ADD COLUMN IF NOT EXISTS salesforce_account_owner_id text,                            -- Account Owner Id
  ADD COLUMN IF NOT EXISTS salesforce_account_sdr_owner_id text,                        -- Account SDR Owner Id
  ADD COLUMN IF NOT EXISTS salesforce_contact_owner_id text,                            -- Contact Owner Id
  ADD COLUMN IF NOT EXISTS salesforce_contact_sdr_owner_id text;                        -- Contact SDR Owner Id

-- Optional: comments to document usage
COMMENT ON COLUMN public.event_leads.salesforce_status_detail IS 'Normalized Salesforce match result: existing_account_existing_contact | existing_account_new_contact | net_new_account_contact';
COMMENT ON COLUMN public.event_leads.sf_existing_account IS 'True if a matching Salesforce Account exists';
COMMENT ON COLUMN public.event_leads.sf_existing_contact IS 'True if a matching Salesforce Contact exists';
COMMENT ON COLUMN public.event_leads.sf_existing_lead IS 'True if a matching Salesforce Lead exists';
COMMENT ON COLUMN public.event_leads.salesforce_lead_id IS 'Salesforce Lead ID when an SF Lead record is the match';
COMMENT ON COLUMN public.event_leads.salesforce_account_owner_id IS 'Salesforce Account Owner ID';
COMMENT ON COLUMN public.event_leads.salesforce_account_sdr_owner_id IS 'Salesforce Account SDR Owner ID';
COMMENT ON COLUMN public.event_leads.salesforce_contact_owner_id IS 'Salesforce Contact Owner ID';
COMMENT ON COLUMN public.event_leads.salesforce_contact_sdr_owner_id IS 'Salesforce Contact SDR Owner ID';
