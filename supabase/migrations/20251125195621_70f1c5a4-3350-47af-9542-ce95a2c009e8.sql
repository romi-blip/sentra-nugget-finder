-- Create content_plan_items table
CREATE TABLE public.content_plan_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  strategic_purpose TEXT NOT NULL,
  target_keywords TEXT,
  outline TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  content TEXT,
  research_notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_plan_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all content items"
ON public.content_plan_items
FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Marketing can view all content items"
ON public.content_plan_items
FOR SELECT
USING (has_role(auth.uid(), 'marketing'));

CREATE POLICY "Marketing can create content items"
ON public.content_plan_items
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'marketing') AND auth.uid() = created_by);

CREATE POLICY "Marketing can update their own content items"
ON public.content_plan_items
FOR UPDATE
USING (has_role(auth.uid(), 'marketing') AND auth.uid() = created_by);

-- Trigger for updated_at
CREATE TRIGGER update_content_plan_items_updated_at
BEFORE UPDATE ON public.content_plan_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();