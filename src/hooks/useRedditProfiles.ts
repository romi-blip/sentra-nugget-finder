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
  // New managed profile fields
  profile_type: 'tracked' | 'managed';
  persona_summary: string | null;
  persona_generated_at: string | null;
  expertise_areas: string[] | null;
  writing_style: string | null;
  typical_tone: string | null;
}

export function useRedditProfiles(profileType?: 'tracked' | 'managed' | 'all') {
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading, error, refetch } = useQuery({
    queryKey: ['reddit-profiles', profileType],
    queryFn: async () => {
      let query = supabase
        .from('reddit_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileType && profileType !== 'all') {
        query = query.eq('profile_type', profileType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as RedditProfile[];
    },
  });

  const addProfile = useMutation({
    mutationFn: async ({ reddit_username, profile_type = 'tracked' }: { reddit_username: string; profile_type?: 'tracked' | 'managed' }) => {
      const { data, error } = await supabase.functions.invoke('fetch-reddit-profile', {
        body: { reddit_username, profile_type },
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

  const generatePersona = useMutation({
    mutationFn: async (profile_id: string) => {
      const { data, error } = await supabase.functions.invoke('generate-profile-persona', {
        body: { profile_id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-profiles'] });
      toast.success('Persona generated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate persona: ${error.message}`);
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

  const updateProfileType = useMutation({
    mutationFn: async ({ profile_id, profile_type }: { profile_id: string; profile_type: 'tracked' | 'managed' }) => {
      const { error } = await supabase
        .from('reddit_profiles')
        .update({ profile_type })
        .eq('id', profile_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-profiles'] });
      toast.success('Profile type updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update profile type: ${error.message}`);
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

  // Filter helpers
  const trackedProfiles = profiles.filter(p => p.profile_type === 'tracked');
  const managedProfiles = profiles.filter(p => p.profile_type === 'managed');

  return {
    profiles,
    trackedProfiles,
    managedProfiles,
    isLoading,
    error,
    refetch,
    addProfile,
    syncProfile,
    generatePersona,
    toggleActive,
    updateProfileType,
    removeProfile,
  };
}
