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
      // If job is still pending, running, or processing, poll every 2 seconds
      if (query.state.data?.status === 'pending' || 
          query.state.data?.status === 'running' || 
          query.state.data?.status === 'processing') {
        return 2000;
      }
      // If completed, failed, or no data, don't poll
      return false;
    },
  });
}