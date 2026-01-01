import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SchedulerSettings {
  id: string;
  scheduler_enabled: boolean;
  default_run_time: string;
  last_run_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useSchedulerSettings() {
  const [settings, setSettings] = useState<SchedulerSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('llm_ranking_scheduler_settings')
        .select('*')
        .single();

      if (error) throw error;
      setSettings(data as SchedulerSettings);
    } catch (error: any) {
      console.error('Error fetching scheduler settings:', error);
      toast.error('Failed to load scheduler settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<SchedulerSettings>): Promise<boolean> => {
    if (!settings) return false;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('llm_ranking_scheduler_settings')
        .update(updates)
        .eq('id', settings.id);

      if (error) throw error;
      
      setSettings({ ...settings, ...updates });
      toast.success('Scheduler settings updated');
      return true;
    } catch (error: any) {
      console.error('Error updating scheduler settings:', error);
      toast.error(error.message || 'Failed to update settings');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const toggleScheduler = async (enabled: boolean): Promise<boolean> => {
    return updateSettings({ scheduler_enabled: enabled });
  };

  const setDefaultRunTime = async (time: string): Promise<boolean> => {
    return updateSettings({ default_run_time: time });
  };

  return {
    settings,
    isLoading,
    isSaving,
    fetchSettings,
    updateSettings,
    toggleScheduler,
    setDefaultRunTime,
  };
}
