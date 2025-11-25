import { supabase } from "@/integrations/supabase/client";

export interface ContentPlanItem {
  id: string;
  title: string;
  strategic_purpose: string;
  target_keywords: string | null;
  outline: string | null;
  status: string;
  content: string | null;
  research_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateContentItemData {
  title: string;
  strategic_purpose: string;
  target_keywords?: string;
  outline?: string;
}

export const contentService = {
  async getAll(): Promise<ContentPlanItem[]> {
    const { data, error } = await supabase
      .from('content_plan_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ContentPlanItem[];
  },

  async create(item: CreateContentItemData, userId: string): Promise<ContentPlanItem> {
    const { data, error } = await supabase
      .from('content_plan_items')
      .insert({
        title: item.title,
        strategic_purpose: item.strategic_purpose,
        target_keywords: item.target_keywords || null,
        outline: item.outline || null,
        created_by: userId,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;
    return data as ContentPlanItem;
  },

  async createBulk(items: CreateContentItemData[], userId: string): Promise<ContentPlanItem[]> {
    const insertData = items.map(item => ({
      title: item.title,
      strategic_purpose: item.strategic_purpose,
      target_keywords: item.target_keywords || null,
      outline: item.outline || null,
      created_by: userId,
      status: 'draft',
    }));

    const { data, error } = await supabase
      .from('content_plan_items')
      .insert(insertData)
      .select();

    if (error) throw error;
    return (data || []) as ContentPlanItem[];
  },

  async update(id: string, updates: Partial<CreateContentItemData & { status: string; content: string; research_notes: string }>): Promise<ContentPlanItem> {
    const { data, error } = await supabase
      .from('content_plan_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ContentPlanItem;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('content_plan_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async deleteBulk(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from('content_plan_items')
      .delete()
      .in('id', ids);

    if (error) throw error;
  },
};
