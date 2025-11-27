import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ContentReview {
  id: string;
  content_item_id: string;
  reviewer_version: number;
  review_result: any;
  review_summary: string | null;
  overall_score: number | null;
  status: string;
  human_feedback: string | null;
  feedback_applied: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReviewerFeedbackPattern {
  id: string;
  feedback_type: string;
  feedback_pattern: string;
  feedback_instruction: string;
  priority: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const useContentReview = (contentItemId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch latest review for a content item
  const reviewQuery = useQuery({
    queryKey: ['content-review', contentItemId],
    queryFn: async () => {
      if (!contentItemId) return null;
      const { data, error } = await supabase
        .from('content_reviews')
        .select('*')
        .eq('content_item_id', contentItemId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as ContentReview | null;
    },
    enabled: !!contentItemId,
  });

  // Run review mutation
  const runReviewMutation = useMutation({
    mutationFn: async (itemId: string) => {
      // Update status to reviewing
      await supabase
        .from('content_plan_items')
        .update({ review_status: 'reviewing' })
        .eq('id', itemId);

      const { data, error } = await supabase.functions.invoke('review-content', {
        body: { contentItemId: itemId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-review', contentItemId] });
      queryClient.invalidateQueries({ queryKey: ['content-plan-items'] });
      toast({ title: "Review completed" });
    },
    onError: (error: Error) => {
      // Revert review status on error
      if (contentItemId) {
        supabase
          .from('content_plan_items')
          .update({ review_status: 'not_reviewed' })
          .eq('id', contentItemId);
      }
      toast({ 
        title: "Review failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Apply review feedback mutation
  const applyFeedbackMutation = useMutation({
    mutationFn: async ({ itemId, reviewId }: { itemId: string; reviewId?: string }) => {
      const { data, error } = await supabase.functions.invoke('apply-review-feedback', {
        body: { contentItemId: itemId, reviewId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-review', contentItemId] });
      queryClient.invalidateQueries({ queryKey: ['content-plan-items'] });
      toast({ title: "Content revised based on feedback" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to apply feedback", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Add feedback to reviewer agent mutation
  const addFeedbackMutation = useMutation({
    mutationFn: async ({ reviewId, humanFeedback }: { reviewId: string; humanFeedback: string }) => {
      const { data, error } = await supabase.functions.invoke('update-reviewer-agent', {
        body: { reviewId, humanFeedback },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['content-review', contentItemId] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-patterns'] });
      toast({ 
        title: data.pattern ? "Feedback pattern added" : "Feedback recorded",
        description: data.message
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to add feedback", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  return {
    review: reviewQuery.data,
    isLoadingReview: reviewQuery.isLoading,
    runReview: runReviewMutation.mutate,
    isReviewing: runReviewMutation.isPending,
    applyFeedback: applyFeedbackMutation.mutate,
    isApplyingFeedback: applyFeedbackMutation.isPending,
    addFeedback: addFeedbackMutation.mutate,
    isAddingFeedback: addFeedbackMutation.isPending,
  };
};

// Hook for reviewer feedback patterns
export const useReviewerPatterns = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const patternsQuery = useQuery({
    queryKey: ['reviewer-patterns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_reviewer_feedback')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ReviewerFeedbackPattern[];
    },
  });

  const togglePatternMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('content_reviewer_feedback')
        .update({ is_active: isActive })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewer-patterns'] });
      toast({ title: "Pattern updated" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update pattern", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const deletePatternMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('content_reviewer_feedback')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewer-patterns'] });
      toast({ title: "Pattern deleted" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to delete pattern", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  return {
    patterns: patternsQuery.data || [],
    isLoading: patternsQuery.isLoading,
    togglePattern: togglePatternMutation.mutate,
    deletePattern: deletePatternMutation.mutate,
    isToggling: togglePatternMutation.isPending,
    isDeleting: deletePatternMutation.isPending,
  };
};
