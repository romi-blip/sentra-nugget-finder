import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DocumentTemplate {
  id: string;
  name: string;
  page_type: 'cover' | 'toc' | 'text' | 'table' | 'appendix';
  html_content: string;
  css_content: string | null;
  placeholders: string[];
  header_html: string | null;
  footer_html: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  image_base64?: string | null;
}

export function useDocumentTemplates() {
  return useQuery({
    queryKey: ['document-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('page_type', { ascending: true })
        .order('is_default', { ascending: false });
      
      if (error) throw error;
      return data as DocumentTemplate[];
    },
  });
}

export function useDocumentTemplatesByType(pageType: string) {
  return useQuery({
    queryKey: ['document-templates', pageType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('page_type', pageType)
        .order('is_default', { ascending: false });
      
      if (error) throw error;
      return data as DocumentTemplate[];
    },
    enabled: !!pageType,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (template: Omit<DocumentTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      // Use any to handle image_base64 field
      const { data, error } = await supabase
        .from('document_templates')
        .insert(template as any)
        .select()
        .single();
      
      if (error) throw error;
      return data as DocumentTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      toast.success('Template saved successfully');
    },
    onError: (error) => {
      toast.error(`Failed to save template: ${error.message}`);
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DocumentTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('document_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as DocumentTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      toast.success('Template updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      toast.success('Template deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });
}

export function useSetDefaultTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, pageType }: { id: string; pageType: string }) => {
      // First, unset all defaults for this page type
      await supabase
        .from('document_templates')
        .update({ is_default: false })
        .eq('page_type', pageType);
      
      // Then set the new default
      const { data, error } = await supabase
        .from('document_templates')
        .update({ is_default: true })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as DocumentTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      toast.success('Default template updated');
    },
    onError: (error) => {
      toast.error(`Failed to set default: ${error.message}`);
    },
  });
}
