import { supabase } from "@/integrations/supabase/client";

export interface Lead {
  id: string;
  event_id: string;
  lead_status?: string;
  first_name: string;
  last_name: string;
  email: string;
  account_name: string;
  title?: string;
  lead_exclusion_field?: string;
  mailing_street?: string;
  mailing_city?: string;
  mailing_state_province?: string;
  mailing_zip_postal_code?: string;
  mailing_country?: string;
  notes?: string;
  phone?: string;
  mobile?: string;
  email_opt_out: boolean;
  linkedin?: string;
  latest_lead_source?: string;
  latest_lead_source_details?: string;
  validation_status?: string;
  validation_errors?: any;
  sync_errors?: any;
  salesforce_status?: string;
  salesforce_status_detail?: string;
  sf_existing_account?: boolean;
  sf_existing_contact?: boolean;
  sf_existing_lead?: boolean;
  sf_existing_customer?: boolean;
  sf_existing_opportunity?: boolean;
  salesforce_lead_id?: string;
  salesforce_account_id?: string;
  salesforce_contact_id?: string;
  salesforce_owner_id?: string;
  salesforce_sdr_owner_id?: string;
  salesforce_account_owner_id?: string;
  salesforce_account_sdr_owner_id?: string;
  salesforce_account_sdr_owner_email?: string;
  salesforce_contact_owner_id?: string;
  salesforce_contact_sdr_owner_id?: string;
  manual_owner_email?: string;
  enrichment_status?: string;
  zoominfo_phone_1?: string;
  zoominfo_phone_2?: string;
  zoominfo_company_state?: string;
  zoominfo_company_country?: string;
  sync_status?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLeadPayload {
  event_id: string;
  lead_status?: string;
  first_name: string;
  last_name: string;
  email: string;
  account_name: string;
  title?: string;
  lead_exclusion_field?: string;
  mailing_street?: string;
  mailing_city?: string;
  mailing_state_province?: string;
  mailing_zip_postal_code?: string;
  mailing_country?: string;
  notes?: string;
  phone?: string;
  mobile?: string;
  email_opt_out?: boolean;
  linkedin?: string;
  latest_lead_source?: string;
  latest_lead_source_details?: string;
  manual_owner_email?: string;
}

export interface UpdateLeadPayload {
  lead_status?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  account_name?: string;
  title?: string;
  lead_exclusion_field?: string;
  mailing_street?: string;
  mailing_city?: string;
  mailing_state_province?: string;
  mailing_zip_postal_code?: string;
  mailing_country?: string;
  notes?: string;
  phone?: string;
  mobile?: string;
  email_opt_out?: boolean;
  linkedin?: string;
  latest_lead_source?: string;
  latest_lead_source_details?: string;
  manual_owner_email?: string;
}

export class LeadsService {
  static async getLeads(eventId: string, page = 1, limit = 50, validationStatus?: 'completed' | 'failed'): Promise<{ data: Lead[]; error: any; count: number }> {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('event_leads')
      .select('*', { count: 'exact' })
      .eq('event_id', eventId);

    if (validationStatus) {
      query = query.eq('validation_status', validationStatus);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data: data as Lead[] || [], error, count: count || 0 };
  }

  static async createLead(payload: CreateLeadPayload): Promise<{ data: Lead | null; error: any }> {
    const { data, error } = await supabase
      .from('event_leads')
      .insert(payload)
      .select()
      .single();

    return { data: data as Lead, error };
  }

  static async updateLead(id: string, payload: UpdateLeadPayload): Promise<{ data: Lead | null; error: any }> {
    const { data, error } = await supabase
      .from('event_leads')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    return { data: data as Lead, error };
  }

  static async deleteLead(id: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('event_leads')
      .delete()
      .eq('id', id);

    return { error };
  }

  static async deleteLeads(ids: string[]): Promise<{ error: any }> {
    const { error } = await supabase
      .from('event_leads')
      .delete()
      .in('id', ids);

    return { error };
  }

  static async upsertLeads(eventId: string, leads: CreateLeadPayload[]): Promise<{ data: Lead[] | null; error: any }> {
    // Prepare leads with event_id and normalize emails
    const leadsWithEventId = leads.map(lead => ({
      ...lead,
      event_id: eventId,
      email: lead.email.toLowerCase().trim(), // Normalize email for consistency
      email_opt_out: lead.email_opt_out ?? false,
    }));

    // Use upsert with conflict resolution on (event_id, email) - ignore duplicates
    const { data, error } = await supabase
      .from('event_leads')
      .upsert(leadsWithEventId, { 
        onConflict: 'event_id,email',
        ignoreDuplicates: true // This will ignore conflicts instead of throwing errors
      })
      .select();

    return { data: data as Lead[], error };
  }

  static async searchLeads(eventId: string, searchTerm: string): Promise<{ data: Lead[]; error: any }> {
    const { data, error } = await supabase
      .from('event_leads')
      .select('*')
      .eq('event_id', eventId)
      .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,account_name.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false });

    return { data: data as Lead[] || [], error };
  }

  static async getValidationCounts(eventId: string): Promise<{ 
    validCount: number; 
    invalidCount: number; 
    emailValidCount: number;
    emailInvalidCount: number;  
    error: any 
  }> {
    try {
      const [validResult, invalidResult, emailValidResult, emailInvalidResult] = await Promise.all([
        supabase
          .from('event_leads')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('validation_status', 'completed'),
        supabase
          .from('event_leads')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('validation_status', 'failed'),
        supabase
          .from('event_leads')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('email_validation_status', 'valid'),
        supabase
          .from('event_leads')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('email_validation_status', 'invalid')
      ]);

      if (validResult.error) throw validResult.error;
      if (invalidResult.error) throw invalidResult.error;
      if (emailValidResult.error) throw emailValidResult.error;
      if (emailInvalidResult.error) throw emailInvalidResult.error;

      return {
        validCount: validResult.count || 0,
        invalidCount: invalidResult.count || 0,
        emailValidCount: emailValidResult.count || 0,
        emailInvalidCount: emailInvalidResult.count || 0,
        error: null
      };
    } catch (error) {
      return { 
        validCount: 0, 
        invalidCount: 0, 
        emailValidCount: 0,
        emailInvalidCount: 0,
        error 
      };
    }
  }

  static async validateEmails(eventId: string): Promise<{ success: boolean; message: string; job_id?: string; error?: any }> {
    try {
      const { data, error } = await supabase.functions.invoke('leads-validate', {
        body: { event_id: eventId }
      });

      if (error) {
        console.error('Email validation error:', error);
        return { success: false, message: 'Failed to start email validation', error };
      }

      return { 
        success: true, 
        message: data.message || 'Email validation started successfully',
        job_id: data.job_id 
      };
    } catch (error) {
      console.error('Email validation failed:', error);
      return { success: false, message: 'Failed to start email validation', error };
    }
  }

  static async checkSalesforceStatus(eventId: string): Promise<{ success: boolean; message: string; job_id?: string; error?: any }> {
    try {
      const { data, error } = await supabase.functions.invoke('leads-check-salesforce', {
        body: { event_id: eventId }
      });

      if (error) {
        console.error('Salesforce check error:', error);
        return { success: false, message: 'Failed to start Salesforce check', error };
      }

      return { 
        success: true, 
        message: data.message || 'Salesforce check started successfully',
        job_id: data.job_id 
      };
    } catch (error) {
      console.error('Salesforce check failed:', error);
      return { success: false, message: 'Failed to start Salesforce check', error };
    }
  }

  static async enrichLeads(eventId: string): Promise<{ success: boolean; message: string; job_id?: string; error?: any }> {
    try {
      // First, get the total leads count for this event
      const { count: totalLeads, error: countError } = await supabase
        .from('event_leads')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .neq('validation_status', 'failed');

      if (countError) {
        console.error('Error getting leads count:', countError);
        return { success: false, message: 'Failed to get leads count', error: countError };
      }

      // Create a job record in lead_processing_jobs
      const { data: jobData, error: jobError } = await supabase
        .from('lead_processing_jobs')
        .insert({
          event_id: eventId,
          stage: 'enrich',
          status: 'running',
          total_leads: totalLeads || 0,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (jobError) {
        console.error('Error creating job record:', jobError);
        return { success: false, message: 'Failed to create job record', error: jobError };
      }

      // Trigger external N8N workflow with job_id
      const webhookUrl = 'https://sentra.app.n8n.cloud/webhook/af111dbd-b920-4884-b2ed-fad53f440ec6';
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          event_id: eventId,
          job_id: jobData.id 
        })
      });

      if (!res.ok) {
        // Update job status to failed
        await supabase
          .from('lead_processing_jobs')
          .update({ 
            status: 'failed', 
            error_message: 'Failed to trigger webhook',
            completed_at: new Date().toISOString()
          })
          .eq('id', jobData.id);

        const text = await res.text();
        console.error('N8N webhook error:', res.status, text);
        return { success: false, message: 'Failed to trigger enrichment webhook', error: text };
      }

      return {
        success: true,
        message: 'Lead enrichment started successfully',
        job_id: jobData.id
      };
    } catch (error) {
      console.error('Lead enrichment failed:', error);
      return { success: false, message: 'Failed to start lead enrichment', error };
    }
  }

  static async syncToSalesforce(eventId: string, leadIds?: string[]): Promise<{ success: boolean; message: string; job_id?: string; error?: any }> {
    try {
      const { data, error } = await supabase.functions.invoke('leads-sync-salesforce', {
        body: { 
          event_id: eventId,
          lead_ids: leadIds 
        }
      });

      if (error) {
        console.error('Salesforce sync failed:', error);
        return { success: false, message: 'Failed to start Salesforce sync', error };
      }

      return {
        success: true,
        message: 'Salesforce sync started successfully',
        job_id: data?.job_id
      };
    } catch (error) {
      console.error('Salesforce sync failed:', error);
      return { success: false, message: 'Failed to start Salesforce sync', error };
    }
  }
}
