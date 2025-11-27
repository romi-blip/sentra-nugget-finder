-- Create content_reviewer_feedback table for learned patterns
CREATE TABLE public.content_reviewer_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('style', 'accuracy', 'tone', 'structure', 'messaging', 'general')),
  feedback_pattern TEXT NOT NULL,
  feedback_instruction TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create content_reviews table for individual reviews
CREATE TABLE public.content_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_item_id UUID NOT NULL REFERENCES public.content_plan_items(id) ON DELETE CASCADE,
  reviewer_version INTEGER NOT NULL DEFAULT 1,
  review_result JSONB,
  review_summary TEXT,
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'passed', 'needs_changes', 'revised')),
  human_feedback TEXT,
  feedback_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add review columns to content_plan_items
ALTER TABLE public.content_plan_items 
ADD COLUMN review_status TEXT DEFAULT 'not_reviewed' CHECK (review_status IN ('not_reviewed', 'reviewing', 'reviewed', 'approved', 'needs_revision')),
ADD COLUMN latest_review_id UUID REFERENCES public.content_reviews(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.content_reviewer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies for content_reviewer_feedback
CREATE POLICY "Admins can manage reviewer feedback"
ON public.content_reviewer_feedback
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Marketing can view reviewer feedback"
ON public.content_reviewer_feedback
FOR SELECT
USING (has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "Marketing can create reviewer feedback"
ON public.content_reviewer_feedback
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'marketing'::app_role) AND auth.uid() = created_by);

-- RLS policies for content_reviews
CREATE POLICY "Admins can manage all reviews"
ON public.content_reviews
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Marketing can view all reviews"
ON public.content_reviews
FOR SELECT
USING (has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "Marketing can create reviews for their content"
ON public.content_reviews
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'marketing'::app_role) AND EXISTS (
  SELECT 1 FROM content_plan_items WHERE id = content_item_id AND created_by = auth.uid()
));

CREATE POLICY "Marketing can update reviews for their content"
ON public.content_reviews
FOR UPDATE
USING (has_role(auth.uid(), 'marketing'::app_role) AND EXISTS (
  SELECT 1 FROM content_plan_items WHERE id = content_item_id AND created_by = auth.uid()
));

-- Create indexes
CREATE INDEX idx_content_reviews_content_item_id ON public.content_reviews(content_item_id);
CREATE INDEX idx_content_reviews_status ON public.content_reviews(status);
CREATE INDEX idx_content_reviewer_feedback_type ON public.content_reviewer_feedback(feedback_type);
CREATE INDEX idx_content_reviewer_feedback_active ON public.content_reviewer_feedback(is_active);

-- Update triggers
CREATE TRIGGER update_content_reviewer_feedback_updated_at
BEFORE UPDATE ON public.content_reviewer_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_reviews_updated_at
BEFORE UPDATE ON public.content_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();