import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RedditProfile {
  id: string;
  user_id: string;
  reddit_username: string;
  display_name: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  link_karma: number;
  comment_karma: number;
  total_karma: number;
  account_created_at: string | null;
  is_verified: boolean;
  is_premium: boolean;
  description: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useRedditProfiles() {
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading, error, refetch } = useQuery({
    queryKey: ['reddit-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reddit_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RedditProfile[];
    },
  });

  const addProfile = useMutation({
    mutationFn: async (reddit_username: string) => {
      const { data, error } = await supabase.functions.invoke('fetch-reddit-profile', {
        body: { reddit_username },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-profiles'] });
      toast.success('Reddit profile added successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add profile: ${error.message}`);
    },
  });

  const syncProfile = useMutation({
    mutationFn: async (profile_id: string) => {
      const { data, error } = await supabase.functions.invoke('sync-reddit-profile-activity', {
        body: { profile_id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['reddit-profile-activity'] });
      toast.success('Profile synced successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to sync profile: ${error.message}`);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ profile_id, is_active }: { profile_id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('reddit_profiles')
        .update({ is_active })
        .eq('id', profile_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-profiles'] });
      toast.success('Profile updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });

  const removeProfile = useMutation({
    mutationFn: async (profile_id: string) => {
      const { error } = await supabase
        .from('reddit_profiles')
        .delete()
        .eq('id', profile_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-profiles'] });
      toast.success('Profile removed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove profile: ${error.message}`);
    },
  });

  return {
    profiles,
    isLoading,
    error,
    refetch,
    addProfile,
    syncProfile,
    toggleActive,
    removeProfile,
  };
}
