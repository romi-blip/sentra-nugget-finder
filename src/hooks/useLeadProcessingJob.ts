import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LeadProcessingJob {
  id: string;
  event_id: string;
  stage: string;
  status: string;
  total_leads: number;
  processed_leads: number;
  failed_leads: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  current_stage: string | null;
  stage_progress: number | null;
  estimated_completion_time: string | null;
  stage_description: string | null;
}

export function useLeadProcessingJob(eventId: string, stage: string) {
  return useQuery<LeadProcessingJob | null>({
    queryKey: ['lead-processing-job', eventId, stage],
    queryFn: async (): Promise<LeadProcessingJob | null> => {
      const { data, error } = await supabase
        .from('lead_processing_jobs')
        .select('*')
        .eq('event_id', eventId)
        .eq('stage', stage)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    enabled: !!eventId && !!stage,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // If no job found yet or job is pending/running/processing, poll every 2s
      if (!status || status === 'pending' || status === 'running' || status === 'processing') {
        return 2000;
      }
      // If completed or failed, stop polling
      return false;
    },
    refetchIntervalInBackground: true,
  });
}