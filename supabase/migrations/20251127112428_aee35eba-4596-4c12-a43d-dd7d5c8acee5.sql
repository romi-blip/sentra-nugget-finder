-- Create lead_research table for storing researched leads
CREATE TABLE public.lead_research (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  input_type TEXT NOT NULL CHECK (input_type IN ('salesforce', 'linkedin', 'manual')),
  input_url TEXT,
  salesforce_id TEXT,
  salesforce_object_type TEXT CHECK (salesforce_object_type IN ('lead', 'contact', 'account')),
  linkedin_url TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  email TEXT,
  title TEXT,
  company_name TEXT,
  company_website TEXT,
  company_linkedin TEXT,
  company_industry TEXT,
  company_size TEXT,
  location TEXT,
  raw_salesforce_data JSONB,
  raw_linkedin_data JSONB,
  raw_web_research JSONB,
  research_summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'researching', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead_research_feed table for activity feed
CREATE TABLE public.lead_research_feed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_research_id UUID NOT NULL REFERENCES public.lead_research(id) ON DELETE CASCADE,
  feed_type TEXT NOT NULL CHECK (feed_type IN ('linkedin_post', 'twitter_post', 'news_mention', 'company_update')),
  source_url TEXT,
  title TEXT,
  content TEXT NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_research_feed ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_research
CREATE POLICY "Users can view their own lead research"
  ON public.lead_research FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lead research"
  ON public.lead_research FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lead research"
  ON public.lead_research FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lead research"
  ON public.lead_research FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all lead research"
  ON public.lead_research FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- RLS policies for lead_research_feed
CREATE POLICY "Users can view feed for their lead research"
  ON public.lead_research_feed FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.lead_research lr
    WHERE lr.id = lead_research_feed.lead_research_id
    AND lr.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all feed items"
  ON public.lead_research_feed FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_lead_research_user_id ON public.lead_research(user_id);
CREATE INDEX idx_lead_research_status ON public.lead_research(status);
CREATE INDEX idx_lead_research_feed_lead_id ON public.lead_research_feed(lead_research_id);

-- Create updated_at trigger
CREATE TRIGGER update_lead_research_updated_at
  BEFORE UPDATE ON public.lead_research
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();