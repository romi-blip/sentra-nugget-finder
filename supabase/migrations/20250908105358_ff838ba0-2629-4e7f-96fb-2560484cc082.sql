
-- 1) Add the new column to store the extracted Campaign ID
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS salesforce_campaign_id text;

-- 2) Trigger function to extract Campaign ID from the URL
CREATE OR REPLACE FUNCTION public.set_salesforce_campaign_id_from_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_id text;
BEGIN
  -- If URL is null/empty, clear the ID as well
  IF NEW.salesforce_campaign_url IS NULL OR NEW.salesforce_campaign_url = '' THEN
    NEW.salesforce_campaign_id := NULL;
    RETURN NEW;
  END IF;

  -- Try to extract ID from Lightning-style URLs:
  -- .../lightning/r/Campaign/701V100000RPt8EIAT/view
  v_id := substring(NEW.salesforce_campaign_url FROM 'Campaign/([A-Za-z0-9]{15,18})');

  -- Fallback: try to extract any 15–18 char alphanumeric after a slash
  -- (catches classic URLs: https://naX.salesforce.com/701V100000RPt8EIAT)
  IF v_id IS NULL THEN
    v_id := substring(NEW.salesforce_campaign_url FROM '/([A-Za-z0-9]{15,18})(\\?|/|$)');
  END IF;

  NEW.salesforce_campaign_id := v_id;
  RETURN NEW;
END;
$$;

-- 3) Create trigger to run on insert and when the URL changes
DROP TRIGGER IF EXISTS trg_set_campaign_id ON public.events;

CREATE TRIGGER trg_set_campaign_id
BEFORE INSERT OR UPDATE OF salesforce_campaign_url ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.set_salesforce_campaign_id_from_url();

-- 4) Backfill existing rows
UPDATE public.events
SET salesforce_campaign_id = COALESCE(
  substring(salesforce_campaign_url FROM 'Campaign/([A-Za-z0-9]{15,18})'),
  substring(salesforce_campaign_url FROM '/([A-Za-z0-9]{15,18})(\\?|/|$)')
)
WHERE salesforce_campaign_url IS NOT NULL;

-- 5) Helpful index for lookups
CREATE INDEX IF NOT EXISTS idx_events_salesforce_campaign_id
  ON public.events (salesforce_campaign_id);
