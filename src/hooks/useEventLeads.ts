import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LeadsService, type Lead, type CreateLeadPayload, type UpdateLeadPayload } from "@/services/leadsService";
import { useToast } from "@/hooks/use-toast";

export function useEventLeads(eventId: string, page = 1, limit = 50, validationFilter?: 'all' | 'valid' | 'invalid') {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const validationStatus = validationFilter === 'valid' ? 'completed' : validationFilter === 'invalid' ? 'failed' : undefined;

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['event-leads', eventId, page, limit, validationFilter],
    queryFn: async () => {
      const result = await LeadsService.getLeads(eventId, page, limit, validationStatus);
      if (result.error) {
        throw new Error(result.error.message || 'Failed to fetch leads');
      }
      return result;
    },
    enabled: !!eventId,
  });

  const createLeadMutation = useMutation({
    mutationFn: (payload: CreateLeadPayload) => LeadsService.createLead(payload),
    onSuccess: (result) => {
      if (result.error) {
        toast({
          title: "Error",
          description: result.error.message || "Failed to create lead",
          variant: "destructive",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['event-leads', eventId] });
        queryClient.invalidateQueries({ queryKey: ['events'] }); // Update lead count
        toast({
          title: "Success",
          description: "Lead created successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create lead",
        variant: "destructive",
      });
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateLeadPayload }) => 
      LeadsService.updateLead(id, payload),
    onSuccess: (result) => {
      if (result.error) {
        toast({
          title: "Error",
          description: result.error.message || "Failed to update lead",
          variant: "destructive",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['event-leads', eventId] });
        toast({
          title: "Success",
          description: "Lead updated successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update lead",
        variant: "destructive",
      });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: (id: string) => LeadsService.deleteLead(id),
    onSuccess: (result) => {
      if (result.error) {
        toast({
          title: "Error",
          description: result.error.message || "Failed to delete lead",
          variant: "destructive",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['event-leads', eventId] });
        queryClient.invalidateQueries({ queryKey: ['events'] }); // Update lead count
        toast({
          title: "Success",
          description: "Lead deleted successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete lead",
        variant: "destructive",
      });
    },
  });

  const deleteLeadsMutation = useMutation({
    mutationFn: (ids: string[]) => LeadsService.deleteLeads(ids),
    onSuccess: (result) => {
      if (result.error) {
        toast({
          title: "Error",
          description: result.error.message || "Failed to delete leads",
          variant: "destructive",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['event-leads', eventId] });
        queryClient.invalidateQueries({ queryKey: ['events'] }); // Update lead count
        toast({
          title: "Success",
          description: "Leads deleted successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete leads",
        variant: "destructive",
      });
    },
  });

  const upsertLeadsMutation = useMutation({
    mutationFn: ({ eventId, leads }: { eventId: string; leads: CreateLeadPayload[] }) => 
      LeadsService.upsertLeads(eventId, leads),
    onSuccess: (result) => {
      if (result.error) {
        // Better error handling for common database issues
        const errorMsg = result.error.message || "Failed to upload leads";
        const isDuplicateError = errorMsg.includes('duplicate') || errorMsg.includes('conflict') || errorMsg.includes('unique constraint');
        
        toast({
          title: "Upload Error", 
          description: isDuplicateError 
            ? "Some leads already exist in this list. Try removing duplicates from your CSV first."
            : errorMsg,
          variant: "destructive",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['event-leads', eventId] });
        queryClient.invalidateQueries({ queryKey: ['events'] }); // Update lead count
        // Don't show success toast here - let the batch processing handle it
      }
    },
    onError: (error: any) => {
      const isDuplicateError = error.message?.includes('duplicate') || error.message?.includes('conflict') || error.message?.includes('unique constraint');
      
      toast({
        title: "Upload Failed",
        description: isDuplicateError
          ? "Duplicate leads detected. Please remove duplicates from your CSV and try again."
          : error.message || "Failed to upload leads",
        variant: "destructive",
      });
    },
  });

  return {
    leads: data?.data || [],
    totalCount: data?.count || 0,
    isLoading,
    error,
    refetch,
    createLead: createLeadMutation.mutate,
    updateLead: updateLeadMutation.mutate,
    deleteLead: deleteLeadMutation.mutate,
    deleteLeads: deleteLeadsMutation.mutate,
    upsertLeads: upsertLeadsMutation.mutateAsync, // Export mutateAsync for sequential processing
    isCreating: createLeadMutation.isPending,
    isUpdating: updateLeadMutation.isPending,
    isDeleting: deleteLeadMutation.isPending,
    isUploadingLeads: upsertLeadsMutation.isPending,
  };
}