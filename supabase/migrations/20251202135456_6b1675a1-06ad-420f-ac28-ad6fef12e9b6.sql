-- Drop the overly permissive policy that allows any user to update any job
DROP POLICY IF EXISTS "System can update job status" ON public.chat_jobs;

-- Create a proper policy that only allows users to update their own jobs
CREATE POLICY "Users can update their own jobs"
ON public.chat_jobs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);