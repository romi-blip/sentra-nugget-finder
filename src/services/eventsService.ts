import { supabase } from "@/integrations/supabase/client";

export interface Event {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  details?: string;
  salesforce_campaign_url?: string;
  salesforce_campaign_id?: string;
  latest_lead_source?: string;
  latest_lead_source_details?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  lead_count?: number;
}

export interface CreateEventPayload {
  name: string;
  start_date: string;
  end_date: string;
  details?: string;
  salesforce_campaign_url?: string;
  latest_lead_source: string;
  latest_lead_source_details: string;
}

export interface UpdateEventPayload {
  name?: string;
  start_date?: string;
  end_date?: string;
  details?: string;
  salesforce_campaign_url?: string;
  latest_lead_source?: string;
  latest_lead_source_details?: string;
}

export class EventsService {
  static async getEvents(): Promise<{ data: Event[]; error: any }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: [], error: { message: "User not authenticated" } };
    }

    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_leads(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], error };
    }

    // Transform the data to include lead count
    const eventsWithCounts = data?.map(event => ({
      ...event,
      lead_count: event.event_leads?.[0]?.count || 0
    })) || [];

    return { data: eventsWithCounts, error: null };
  }

  static async createEvent(payload: CreateEventPayload): Promise<{ data: Event | null; error: any }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: { message: "User not authenticated" } };
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        ...payload,
        created_by: user.id,
      })
      .select()
      .single();

    return { data, error };
  }

  static async updateEvent(id: string, payload: UpdateEventPayload): Promise<{ data: Event | null; error: any }> {
    const { data, error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  }

  static async deleteEvent(id: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    return { error };
  }

  static async getEvent(id: string): Promise<{ data: Event | null; error: any }> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    return { data, error };
  }
}