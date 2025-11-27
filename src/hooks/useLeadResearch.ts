import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StartResearchParams {
  inputType: 'salesforce' | 'linkedin' | 'manual';
  inputUrl?: string;
  manualData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    title?: string;
    companyName?: string;
    companyWebsite?: string;
  };
}

export interface LeadResearch {
  id: string;
  user_id: string;
  input_type: string;
  input_url: string | null;
  salesforce_id: string | null;
  salesforce_object_type: string | null;
  linkedin_url: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  title: string | null;
  company_name: string | null;
  company_website: string | null;
  company_linkedin: string | null;
  company_industry: string | null;
  company_size: string | null;
  location: string | null;
  raw_salesforce_data: any;
  raw_linkedin_data: any;
  raw_web_research: any;
  research_summary: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadResearchFeed {
  id: string;
  lead_research_id: string;
  feed_type: string;
  source_url: string | null;
  title: string | null;
  content: string;
  published_at: string | null;
  raw_data: any;
  created_at: string;
}

export function useLeadResearch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all research items for current user
  const { data: researchList = [], isLoading } = useQuery({
    queryKey: ['lead-research'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_research')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as LeadResearch[];
    }
  });

  // Start new research
  const startMutation = useMutation({
    mutationFn: async (params: StartResearchParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create initial record
      const insertData: any = {
        user_id: user.id,
        input_type: params.inputType,
        status: 'pending'
      };

      if (params.inputType === 'salesforce') {
        insertData.input_url = params.inputUrl;
      } else if (params.inputType === 'linkedin') {
        insertData.input_url = params.inputUrl;
        insertData.linkedin_url = params.inputUrl;
      } else if (params.inputType === 'manual' && params.manualData) {
        insertData.first_name = params.manualData.firstName;
        insertData.last_name = params.manualData.lastName;
        insertData.full_name = `${params.manualData.firstName || ''} ${params.manualData.lastName || ''}`.trim() || null;
        insertData.email = params.manualData.email;
        insertData.title = params.manualData.title;
        insertData.company_name = params.manualData.companyName;
        insertData.company_website = params.manualData.companyWebsite;
      }

      const { data: research, error: insertError } = await supabase
        .from('lead_research')
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      // Trigger the research edge function
      const { error: fnError } = await supabase.functions.invoke('research-lead', {
        body: { leadResearchId: research.id }
      });

      if (fnError) {
        console.error('Research function error:', fnError);
        // Don't throw - the record is created and can be retried
      }

      return research;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-research'] });
      toast({
        title: 'Research Started',
        description: 'We are researching your lead. This may take a few minutes.',
      });
    },
    onError: (error) => {
      console.error('Start research error:', error);
      toast({
        title: 'Error',
        description: 'Failed to start research. Please try again.',
        variant: 'destructive'
      });
    }
  });

  return {
    researchList,
    isLoading,
    startResearch: startMutation.mutateAsync,
    isStarting: startMutation.isPending
  };
}

export function useLeadResearchDetail(researchId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch single research with feed
  const { data: research, isLoading } = useQuery({
    queryKey: ['lead-research', researchId],
    queryFn: async () => {
      if (!researchId) return null;

      const { data, error } = await supabase
        .from('lead_research')
        .select('*')
        .eq('id', researchId)
        .single();

      if (error) throw error;
      return data as LeadResearch;
    },
    enabled: !!researchId,
    refetchInterval: (query) => {
      // Poll while researching
      const data = query.state.data as LeadResearch | null;
      return data?.status === 'researching' ? 3000 : false;
    }
  });

  // Fetch feed items
  const { data: feedItems = [] } = useQuery({
    queryKey: ['lead-research-feed', researchId],
    queryFn: async () => {
      if (!researchId) return [];

      const { data, error } = await supabase
        .from('lead_research_feed')
        .select('*')
        .eq('lead_research_id', researchId)
        .order('published_at', { ascending: false });

      if (error) throw error;
      return data as LeadResearchFeed[];
    },
    enabled: !!researchId
  });

  // Refresh feed
  const refreshFeedMutation = useMutation({
    mutationFn: async () => {
      if (!researchId) throw new Error('No research ID');

      const { error } = await supabase.functions.invoke('refresh-lead-feed', {
        body: { leadResearchId: researchId }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-research-feed', researchId] });
      toast({
        title: 'Feed Refreshed',
        description: 'Latest activity has been fetched.',
      });
    },
    onError: (error) => {
      console.error('Refresh feed error:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh feed.',
        variant: 'destructive'
      });
    }
  });

  return {
    research,
    feedItems,
    isLoading,
    refreshFeed: refreshFeedMutation.mutateAsync,
    isRefreshing: refreshFeedMutation.isPending
  };
}
