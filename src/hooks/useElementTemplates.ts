import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ElementType = 
  | 'header' 
  | 'footer' 
  | 'cover_background' 
  | 'logo'
  | 'content_page'
  | 'title' 
  | 'subtitle' 
  | 'h1' 
  | 'h2' 
  | 'h3'
  | 'paragraph' 
  | 'bullet' 
  | 'toc_entry' 
  | 'image_container' 
  | 'page_number';

export interface ElementTemplate {
  id: string;
  name: string;
  element_type: ElementType;
  image_base64: string | null;
  image_height: number | null;
  image_width: number | null;
  svg_content: string | null;
  font_family: string | null;
  font_size: number | null;
  font_weight: string | null;
  font_color: string | null;
  line_height: number | null;
  margin_top: number | null;
  margin_bottom: number | null;
  margin_left: number | null;
  text_align: string | null;
  bullet_character: string | null;
  bullet_indent: number | null;
  position_x: number | null;
  position_y: number | null;
  is_default: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export type CreateElementTemplateInput = Omit<ElementTemplate, 'id' | 'created_at' | 'updated_at'>;

// Fetch all element templates
export function useElementTemplates() {
  return useQuery({
    queryKey: ['element-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('element_templates')
        .select('*')
        .order('element_type', { ascending: true });
      
      if (error) throw error;
      return data as ElementTemplate[];
    },
  });
}

// Fetch element templates by type
export function useElementTemplatesByType(type: ElementType) {
  return useQuery({
    queryKey: ['element-templates', type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('element_templates')
        .select('*')
        .eq('element_type', type)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as ElementTemplate[];
    },
  });
}

// Fetch default element templates (one per type)
export function useDefaultElementTemplates() {
  return useQuery({
    queryKey: ['element-templates', 'defaults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('element_templates')
        .select('*')
        .eq('is_default', true);
      
      if (error) throw error;
      
      // Create a map by element_type for easy access
      const templateMap: Partial<Record<ElementType, ElementTemplate>> = {};
      for (const template of data as ElementTemplate[]) {
        templateMap[template.element_type] = template;
      }
      return templateMap;
    },
  });
}

// Create element template
export function useCreateElementTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateElementTemplateInput) => {
      const { data, error } = await supabase
        .from('element_templates')
        .insert([input])
        .select()
        .single();
      
      if (error) throw error;
      return data as ElementTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['element-templates'] });
    },
  });
}

// Update element template
export function useUpdateElementTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ElementTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('element_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as ElementTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['element-templates'] });
    },
  });
}

// Delete element template
export function useDeleteElementTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('element_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['element-templates'] });
    },
  });
}

// Set element template as default (and unset others of same type)
export function useSetDefaultElementTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, element_type }: { id: string; element_type: ElementType }) => {
      // First, unset all defaults for this element type
      await supabase
        .from('element_templates')
        .update({ is_default: false })
        .eq('element_type', element_type);
      
      // Then set this one as default
      const { data, error } = await supabase
        .from('element_templates')
        .update({ is_default: true })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as ElementTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['element-templates'] });
    },
  });
}

// Visual element types that use image_base64
export const VISUAL_ELEMENT_TYPES: ElementType[] = ['header', 'footer', 'cover_background', 'logo', 'content_page'];

// Text style element types
export const TEXT_ELEMENT_TYPES: ElementType[] = ['title', 'subtitle', 'h1', 'h2', 'h3', 'paragraph', 'bullet', 'toc_entry', 'page_number'];

// Human readable labels for element types
export const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  header: 'Header',
  footer: 'Footer',
  cover_background: 'Cover Background',
  logo: 'Logo',
  content_page: 'Full Content Page',
  title: 'Document Title',
  subtitle: 'Subtitle',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  paragraph: 'Paragraph',
  bullet: 'Bullet Point',
  toc_entry: 'TOC Entry',
  image_container: 'Image Container',
  page_number: 'Page Number',
};
