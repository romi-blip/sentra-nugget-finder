import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DocumentProfile {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  page_margin_top: number;
  page_margin_bottom: number;
  page_margin_left: number;
  page_margin_right: number;
  default_line_height: number;
  paragraph_spacing: number;
  page_break_before_h1: boolean;
  created_at: string;
  updated_at: string;
}

export interface PageLayout {
  id: string;
  profile_id: string;
  page_type: 'cover' | 'toc' | 'content';
  background_element_id: string | null;
  header_element_id: string | null;
  footer_element_id: string | null;
  show_logo: boolean;
  logo_element_id: string | null;
  logo_position_x: number;
  logo_position_y: number;
  created_at: string;
  updated_at: string;
}

export interface PageTextStyle {
  id: string;
  page_layout_id: string;
  context: 'title' | 'subtitle' | 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet' | 'toc_entry' | 'toc_title';
  element_template_id: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch all document profiles
export function useDocumentProfiles() {
  return useQuery({
    queryKey: ['document-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_profiles')
        .select('*')
        .order('is_default', { ascending: false });
      
      if (error) throw error;
      return data as DocumentProfile[];
    },
  });
}

// Fetch a single document profile with its layouts
export function useDocumentProfile(profileId: string | null) {
  return useQuery({
    queryKey: ['document-profile', profileId],
    queryFn: async () => {
      if (!profileId) return null;
      
      const { data, error } = await supabase
        .from('document_profiles')
        .select('*')
        .eq('id', profileId)
        .single();
      
      if (error) throw error;
      return data as DocumentProfile;
    },
    enabled: !!profileId,
  });
}

// Fetch the default document profile
export function useDefaultDocumentProfile() {
  return useQuery({
    queryKey: ['document-profile-default'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_profiles')
        .select('*')
        .eq('is_default', true)
        .single();
      
      if (error) throw error;
      return data as DocumentProfile;
    },
  });
}

// Fetch page layouts for a profile
export function usePageLayouts(profileId: string | null) {
  return useQuery({
    queryKey: ['page-layouts', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      
      const { data, error } = await supabase
        .from('page_layouts')
        .select('*')
        .eq('profile_id', profileId);
      
      if (error) throw error;
      return data as PageLayout[];
    },
    enabled: !!profileId,
  });
}

// Fetch text styles for a page layout
export function usePageTextStyles(layoutId: string | null) {
  return useQuery({
    queryKey: ['page-text-styles', layoutId],
    queryFn: async () => {
      if (!layoutId) return [];
      
      const { data, error } = await supabase
        .from('page_text_styles')
        .select('*')
        .eq('page_layout_id', layoutId);
      
      if (error) throw error;
      return data as PageTextStyle[];
    },
    enabled: !!layoutId,
  });
}

// Fetch all text styles for all layouts of a profile
export function useProfileTextStyles(profileId: string | null) {
  return useQuery({
    queryKey: ['profile-text-styles', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      
      // First get the layout IDs for this profile
      const { data: layouts, error: layoutsError } = await supabase
        .from('page_layouts')
        .select('id')
        .eq('profile_id', profileId);
      
      if (layoutsError) throw layoutsError;
      if (!layouts || layouts.length === 0) return [];
      
      const layoutIds = layouts.map(l => l.id);
      
      const { data, error } = await supabase
        .from('page_text_styles')
        .select('*')
        .in('page_layout_id', layoutIds);
      
      if (error) throw error;
      return data as PageTextStyle[];
    },
    enabled: !!profileId,
  });
}

// Create a new document profile
export function useCreateDocumentProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (profile: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('document_profiles')
        .insert({ name: profile.name, description: profile.description || null })
        .select()
        .single();
      
      if (error) throw error;
      return data as DocumentProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-profiles'] });
      toast({ title: 'Document profile created' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create profile: ' + error.message, variant: 'destructive' });
    },
  });
}

// Update a document profile
export function useUpdateDocumentProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DocumentProfile> & { id: string }) => {
      const { data, error } = await supabase
        .from('document_profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as DocumentProfile;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['document-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['document-profile', data.id] });
      toast({ title: 'Document profile updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update profile: ' + error.message, variant: 'destructive' });
    },
  });
}

// Delete a document profile
export function useDeleteDocumentProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('document_profiles')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-profiles'] });
      toast({ title: 'Document profile deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete profile: ' + error.message, variant: 'destructive' });
    },
  });
}

// Create or update a page layout
export function useUpsertPageLayout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (layout: Partial<PageLayout> & { profile_id: string; page_type: PageLayout['page_type'] }) => {
      const { data, error } = await supabase
        .from('page_layouts')
        .upsert(layout, { onConflict: 'profile_id,page_type' })
        .select()
        .single();
      
      if (error) throw error;
      return data as PageLayout;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['page-layouts', data.profile_id] });
      toast({ title: 'Page layout saved' });
    },
    onError: (error) => {
      toast({ title: 'Failed to save layout: ' + error.message, variant: 'destructive' });
    },
  });
}

// Create or update a text style
export function useUpsertPageTextStyle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (style: Partial<PageTextStyle> & { page_layout_id: string; context: PageTextStyle['context'] }) => {
      const { data, error } = await supabase
        .from('page_text_styles')
        .upsert(style, { onConflict: 'page_layout_id,context' })
        .select()
        .single();
      
      if (error) throw error;
      return data as PageTextStyle;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['page-text-styles', data.page_layout_id] });
      queryClient.invalidateQueries({ queryKey: ['profile-text-styles'] });
    },
    onError: (error) => {
      toast({ title: 'Failed to save text style: ' + error.message, variant: 'destructive' });
    },
  });
}

// Set a profile as default
export function useSetDefaultProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // First unset all defaults
      await supabase
        .from('document_profiles')
        .update({ is_default: false })
        .neq('id', id);
      
      // Then set this one as default
      const { data, error } = await supabase
        .from('document_profiles')
        .update({ is_default: true })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as DocumentProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['document-profile-default'] });
      toast({ title: 'Default profile updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to set default: ' + error.message, variant: 'destructive' });
    },
  });
}
