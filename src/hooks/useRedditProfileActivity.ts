import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RedditProfileActivity {
  id: string;
  profile_id: string;
  activity_type: 'post' | 'comment';
  reddit_id: string;
  subreddit: string | null;
  title: string | null;
  content: string | null;
  permalink: string | null;
  score: number;
  num_comments: number;
  posted_at: string | null;
  created_at: string;
}

interface UseRedditProfileActivityOptions {
  profileId?: string;
  activityType?: 'post' | 'comment';
  limit?: number;
}

export function useRedditProfileActivity(options: UseRedditProfileActivityOptions = {}) {
  const { profileId, activityType, limit = 50 } = options;

  const { data: activity = [], isLoading, error, refetch } = useQuery({
    queryKey: ['reddit-profile-activity', profileId, activityType, limit],
    queryFn: async () => {
      let query = supabase
        .from('reddit_profile_activity')
        .select('*')
        .order('posted_at', { ascending: false })
        .limit(limit);

      if (profileId) {
        query = query.eq('profile_id', profileId);
      }

      if (activityType) {
        query = query.eq('activity_type', activityType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as RedditProfileActivity[];
    },
  });

  return {
    activity,
    isLoading,
    error,
    refetch,
  };
}
