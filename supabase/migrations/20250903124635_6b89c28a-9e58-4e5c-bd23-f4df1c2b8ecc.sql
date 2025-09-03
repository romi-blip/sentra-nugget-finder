
-- 1) Add columns at the list level
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS latest_lead_source text,
  ADD COLUMN IF NOT EXISTS latest_lead_source_details text;

-- 2) Trigger function: set event_leads defaults from parent event if missing
CREATE OR REPLACE FUNCTION public.set_event_lead_source_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_source  text;
  v_details text;
BEGIN
  -- Only fetch and apply if any of the NEW values are null/empty
  IF (NEW.latest_lead_source IS NULL OR NEW.latest_lead_source = '')
     OR (NEW.latest_lead_source_details IS NULL OR NEW.latest_lead_source_details = '') THEN

    SELECT e.latest_lead_source, e.latest_lead_source_details
      INTO v_source, v_details
    FROM public.events e
    WHERE e.id = NEW.event_id;

    IF NEW.latest_lead_source IS NULL OR NEW.latest_lead_source = '' THEN
      NEW.latest_lead_source := v_source;
    END IF;

    IF NEW.latest_lead_source_details IS NULL OR NEW.latest_lead_source_details = '' THEN
      NEW.latest_lead_source_details := v_details;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Bind trigger to event_leads inserts
DROP TRIGGER IF EXISTS trg_event_leads_default_source ON public.event_leads;
CREATE TRIGGER trg_event_leads_default_source
BEFORE INSERT ON public.event_leads
FOR EACH ROW
EXECUTE FUNCTION public.set_event_lead_source_defaults();

-- 4) Backfill existing event_leads where values are null/empty
UPDATE public.event_leads el
SET latest_lead_source = ev.latest_lead_source
FROM public.events ev
WHERE el.event_id = ev.id
  AND (el.latest_lead_source IS NULL OR el.latest_lead_source = '');

UPDATE public.event_leads el
SET latest_lead_source_details = ev.latest_lead_source_details
FROM public.events ev
WHERE el.event_id = ev.id
  AND (el.latest_lead_source_details IS NULL OR el.latest_lead_source_details = '');
