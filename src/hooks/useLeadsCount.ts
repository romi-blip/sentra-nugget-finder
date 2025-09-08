import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLeadsCount(eventId: string) {
  return useQuery({
    queryKey: ['leads-count', eventId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('event_leads')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);

      if (error) {
        throw new Error(error.message);
      }

      return count || 0;
    },
    enabled: !!eventId,
  });
}