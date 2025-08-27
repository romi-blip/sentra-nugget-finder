-- Create chat_jobs table for tracking async webhook jobs
CREATE TABLE IF NOT EXISTS public.chat_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  webhook_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for chat_jobs
CREATE POLICY "Users can view their own jobs"
ON public.chat_jobs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own jobs"
ON public.chat_jobs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update job status"
ON public.chat_jobs
FOR UPDATE
USING (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_chat_jobs_updated_at
BEFORE UPDATE ON public.chat_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key constraints
ALTER TABLE public.chat_jobs 
ADD CONSTRAINT chat_jobs_conversation_id_fkey 
FOREIGN KEY (conversation_id) 
REFERENCES public.chat_conversations(id) 
ON DELETE CASCADE;