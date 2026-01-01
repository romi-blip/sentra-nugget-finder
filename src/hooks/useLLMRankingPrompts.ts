import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LLMRankingPrompt {
  id: string;
  name: string;
  prompt_text: string;
  category: string | null;
  is_active: boolean;
  run_frequency: string;
  last_run_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  schedule_enabled: boolean | null;
  scheduled_time: string | null;
  schedule_days: string[] | null;
  next_scheduled_run: string | null;
}

export interface CreatePromptInput {
  name: string;
  prompt_text: string;
  category?: string;
  is_active?: boolean;
  run_frequency?: string;
}

export interface UpdatePromptInput extends Partial<CreatePromptInput> {
  id: string;
}

export function useLLMRankingPrompts() {
  const [prompts, setPrompts] = useState<LLMRankingPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState<string | null>(null);

  const fetchPrompts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('llm_ranking_prompts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrompts((data as LLMRankingPrompt[]) || []);
    } catch (error: any) {
      console.error('Error fetching prompts:', error);
      toast.error('Failed to load prompts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const createPrompt = async (input: CreatePromptInput): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('llm_ranking_prompts')
        .insert({
          ...input,
          created_by: user.id,
        });

      if (error) throw error;
      toast.success('Prompt created successfully');
      await fetchPrompts();
      return true;
    } catch (error: any) {
      console.error('Error creating prompt:', error);
      toast.error(error.message || 'Failed to create prompt');
      return false;
    }
  };

  const updatePrompt = async (input: UpdatePromptInput): Promise<boolean> => {
    try {
      const { id, ...updates } = input;
      const { error } = await supabase
        .from('llm_ranking_prompts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success('Prompt updated successfully');
      await fetchPrompts();
      return true;
    } catch (error: any) {
      console.error('Error updating prompt:', error);
      toast.error(error.message || 'Failed to update prompt');
      return false;
    }
  };

  const deletePrompt = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('llm_ranking_prompts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Prompt deleted successfully');
      await fetchPrompts();
      return true;
    } catch (error: any) {
      console.error('Error deleting prompt:', error);
      toast.error(error.message || 'Failed to delete prompt');
      return false;
    }
  };

  const triggerPromptRun = async (promptId: string): Promise<boolean> => {
    setIsTriggering(promptId);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-llm-ranking', {
        body: { prompt_id: promptId },
      });

      if (error) throw error;
      
      if (data?.success) {
        toast.success('LLM ranking analysis triggered successfully');
        await fetchPrompts();
        return true;
      } else {
        throw new Error(data?.message || 'Failed to trigger analysis');
      }
    } catch (error: any) {
      console.error('Error triggering prompt run:', error);
      toast.error(error.message || 'Failed to trigger analysis');
      return false;
    } finally {
      setIsTriggering(null);
    }
  };

  const triggerBulkRun = async (promptIds: string[]): Promise<boolean> => {
    setIsTriggering('bulk');
    try {
      const { data, error } = await supabase.functions.invoke('trigger-llm-ranking', {
        body: { prompt_ids: promptIds },
      });

      if (error) throw error;
      
      if (data?.success) {
        toast.success(`Triggered ${data.prompts_count} prompts successfully`);
        await fetchPrompts();
        return true;
      } else {
        throw new Error(data?.message || 'Failed to trigger analysis');
      }
    } catch (error: any) {
      console.error('Error triggering bulk run:', error);
      toast.error(error.message || 'Failed to trigger bulk analysis');
      return false;
    } finally {
      setIsTriggering(null);
    }
  };

  const togglePromptActive = async (id: string, isActive: boolean): Promise<boolean> => {
    return updatePrompt({ id, is_active: isActive });
  };

  const updatePromptSchedule = async (
    id: string,
    scheduleEnabled: boolean,
    scheduledTime: string,
    scheduleDays: string[]
  ): Promise<boolean> => {
    try {
      // Calculate next scheduled run
      let nextScheduledRun: string | null = null;
      if (scheduleEnabled && scheduledTime) {
        const now = new Date();
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        const next = new Date(now);
        next.setDate(next.getDate() + 1);
        next.setHours(hours, minutes, 0, 0);
        
        // Find next matching day if schedule_days is specified
        if (scheduleDays.length > 0) {
          for (let i = 0; i < 7; i++) {
            const dayName = next.toLocaleDateString('en-US', { weekday: 'long' });
            if (scheduleDays.includes(dayName)) {
              break;
            }
            next.setDate(next.getDate() + 1);
          }
        }
        nextScheduledRun = next.toISOString();
      }

      const { error } = await supabase
        .from('llm_ranking_prompts')
        .update({
          schedule_enabled: scheduleEnabled,
          scheduled_time: scheduledTime,
          schedule_days: scheduleDays,
          next_scheduled_run: nextScheduledRun,
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Schedule updated successfully');
      await fetchPrompts();
      return true;
    } catch (error: any) {
      console.error('Error updating prompt schedule:', error);
      toast.error(error.message || 'Failed to update schedule');
      return false;
    }
  };

  return {
    prompts,
    isLoading,
    isTriggering,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    triggerPromptRun,
    triggerBulkRun,
    togglePromptActive,
    updatePromptSchedule,
  };
}
