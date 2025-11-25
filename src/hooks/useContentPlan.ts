import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contentService, CreateContentItemData, ContentPlanItem } from "@/services/contentService";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export const useContentPlan = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['content-plan-items'],
    queryFn: contentService.getAll,
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (item: CreateContentItemData) => {
      if (!user?.id) throw new Error('User not authenticated');
      return contentService.create(item, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-plan-items'] });
      toast({ title: "Content item created" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create content item", description: error.message, variant: "destructive" });
    },
  });

  const createBulkMutation = useMutation({
    mutationFn: (items: CreateContentItemData[]) => {
      if (!user?.id) throw new Error('User not authenticated');
      return contentService.createBulk(items, user.id);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['content-plan-items'] });
      toast({ title: `${data.length} content items imported` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to import content items", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ContentPlanItem> }) => 
      contentService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-plan-items'] });
      toast({ title: "Content item updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update content item", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: contentService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-plan-items'] });
      toast({ title: "Content item deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete content item", description: error.message, variant: "destructive" });
    },
  });

  const deleteBulkMutation = useMutation({
    mutationFn: contentService.deleteBulk,
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['content-plan-items'] });
      toast({ title: `${ids.length} content items deleted` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete content items", description: error.message, variant: "destructive" });
    },
  });

  const researchMutation = useMutation({
    mutationFn: async (id: string) => {
      // First update status to "researching"
      await contentService.update(id, { status: 'researching' });
      queryClient.invalidateQueries({ queryKey: ['content-plan-items'] });
      // Then perform the research
      return contentService.researchTopic(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-plan-items'] });
      toast({ title: "Research completed", description: "Topic research has been saved to the content item." });
    },
    onError: (error: Error, id) => {
      // Revert status back to draft on error
      contentService.update(id, { status: 'draft' }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['content-plan-items'] });
      });
      toast({ title: "Research failed", description: error.message, variant: "destructive" });
    },
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createItem: createMutation.mutate,
    createBulk: createBulkMutation.mutate,
    updateItem: updateMutation.mutate,
    deleteItem: deleteMutation.mutate,
    deleteBulk: deleteBulkMutation.mutate,
    researchItem: researchMutation.mutate,
    isCreating: createMutation.isPending,
    isImporting: createBulkMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isResearching: researchMutation.isPending,
    researchingId: researchMutation.variables,
  };
};
