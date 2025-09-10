import { useQuery } from "@tanstack/react-query";
import { LeadsService } from "@/services/leadsService";

export function useLeadValidationCounts(eventId: string) {
  return useQuery({
    queryKey: ['lead-validation-counts', eventId],
    queryFn: async () => {
      const result = await LeadsService.getValidationCounts(eventId);
      if (result.error) {
        throw new Error(result.error.message || 'Failed to fetch validation counts');
      }
      return result;
    },
    enabled: !!eventId,
    refetchInterval: 5000, // Refresh every 5 seconds during validation
  });
}