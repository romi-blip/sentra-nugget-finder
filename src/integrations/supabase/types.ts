export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      breach_articles: {
        Row: {
          breach_date: string | null
          breach_summary: string | null
          created_at: string | null
          id: string
          status: string | null
          title: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          breach_date?: string | null
          breach_summary?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          breach_date?: string | null
          breach_summary?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          breach_article_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          breach_article_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          breach_article_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_breach_article_id_fkey"
            columns: ["breach_article_id"]
            isOneToOne: false
            referencedRelation: "breach_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_jobs: {
        Row: {
          completed_at: string | null
          conversation_id: string
          created_at: string
          error: string | null
          id: string
          payload: Json
          result: Json | null
          status: string
          updated_at: string
          user_id: string
          webhook_type: string
        }
        Insert: {
          completed_at?: string | null
          conversation_id: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          result?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          webhook_type: string
        }
        Update: {
          completed_at?: string | null
          conversation_id?: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          result?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
          webhook_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          annual_revenue: string | null
          breach_article_id: string | null
          cloud_focus: boolean | null
          company_name: string
          company_type: string
          created_at: string | null
          data_breach_details: string | null
          employee_count: number | null
          headquarters_location: string | null
          icp_score: number | null
          id: string
          impacted_company_id: string | null
          industry: string | null
          organizational_insights: Json | null
          prevention_recommendations: string[] | null
          salesforce_owner: string | null
          status: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          annual_revenue?: string | null
          breach_article_id?: string | null
          cloud_focus?: boolean | null
          company_name: string
          company_type: string
          created_at?: string | null
          data_breach_details?: string | null
          employee_count?: number | null
          headquarters_location?: string | null
          icp_score?: number | null
          id?: string
          impacted_company_id?: string | null
          industry?: string | null
          organizational_insights?: Json | null
          prevention_recommendations?: string[] | null
          salesforce_owner?: string | null
          status?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          annual_revenue?: string | null
          breach_article_id?: string | null
          cloud_focus?: boolean | null
          company_name?: string
          company_type?: string
          created_at?: string | null
          data_breach_details?: string | null
          employee_count?: number | null
          headquarters_location?: string | null
          icp_score?: number | null
          id?: string
          impacted_company_id?: string | null
          industry?: string | null
          organizational_insights?: Json | null
          prevention_recommendations?: string[] | null
          salesforce_owner?: string | null
          status?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_breach_article_id_fkey"
            columns: ["breach_article_id"]
            isOneToOne: false
            referencedRelation: "breach_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_impacted_company_id_fkey"
            columns: ["impacted_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          apollo_phone_1: string | null
          apollo_phone_2: string | null
          company_id: string
          contact_country: string | null
          contact_priority: number | null
          created_at: string | null
          email: string | null
          first_name: string | null
          full_name: string
          id: string
          last_name: string | null
          linkedin_url: string | null
          outreach_status: string | null
          persona_type: string | null
          personalized_email_body: string | null
          personalized_subject: string | null
          salesforce_account_id: string | null
          salesforce_contact_id: string | null
          salesforce_owner_id: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          apollo_phone_1?: string | null
          apollo_phone_2?: string | null
          company_id: string
          contact_country?: string | null
          contact_priority?: number | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name: string
          id?: string
          last_name?: string | null
          linkedin_url?: string | null
          outreach_status?: string | null
          persona_type?: string | null
          personalized_email_body?: string | null
          personalized_subject?: string | null
          salesforce_account_id?: string | null
          salesforce_contact_id?: string | null
          salesforce_owner_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          apollo_phone_1?: string | null
          apollo_phone_2?: string | null
          company_id?: string
          contact_country?: string | null
          contact_priority?: number | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          linkedin_url?: string | null
          outreach_status?: string | null
          persona_type?: string | null
          personalized_email_body?: string | null
          personalized_subject?: string | null
          salesforce_account_id?: string | null
          salesforce_contact_id?: string | null
          salesforce_owner_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_competitors: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      documents_industry: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      documents_news: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      documents_sentra: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      documents_website: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      event_leads: {
        Row: {
          account_name: string
          created_at: string
          email: string
          email_opt_out: boolean
          event_id: string
          first_name: string
          id: string
          last_name: string
          latest_lead_source: string | null
          latest_lead_source_details: string | null
          lead_exclusion_field: string | null
          lead_status: string | null
          linkedin: string | null
          mailing_city: string | null
          mailing_country: string | null
          mailing_state_province: string | null
          mailing_street: string | null
          mailing_zip_postal_code: string | null
          mobile: string | null
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          created_at?: string
          email: string
          email_opt_out?: boolean
          event_id: string
          first_name: string
          id?: string
          last_name: string
          latest_lead_source?: string | null
          latest_lead_source_details?: string | null
          lead_exclusion_field?: string | null
          lead_status?: string | null
          linkedin?: string | null
          mailing_city?: string | null
          mailing_country?: string | null
          mailing_state_province?: string | null
          mailing_street?: string | null
          mailing_zip_postal_code?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          created_at?: string
          email?: string
          email_opt_out?: boolean
          event_id?: string
          first_name?: string
          id?: string
          last_name?: string
          latest_lead_source?: string | null
          latest_lead_source_details?: string | null
          lead_exclusion_field?: string | null
          lead_status?: string | null
          linkedin?: string | null
          mailing_city?: string | null
          mailing_country?: string | null
          mailing_state_province?: string | null
          mailing_street?: string | null
          mailing_zip_postal_code?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_leads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string
          details: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          details?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          details?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      global_webhooks: {
        Row: {
          created_at: string
          enabled: boolean
          headers: Json | null
          id: string
          last_tested: string | null
          last_used: string | null
          name: string
          retry_attempts: number
          timeout: number
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          headers?: Json | null
          id?: string
          last_tested?: string | null
          last_used?: string | null
          name: string
          retry_attempts?: number
          timeout?: number
          type: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          headers?: Json | null
          id?: string
          last_tested?: string | null
          last_used?: string | null
          name?: string
          retry_attempts?: number
          timeout?: number
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      knowledge_files: {
        Row: {
          created_at: string
          file_path: string | null
          file_type: string
          id: string
          knowledgebases: string[]
          processing_status: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          file_type: string
          id?: string
          knowledgebases: string[]
          processing_status?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string | null
          file_type?: string
          id?: string
          knowledgebases?: string[]
          processing_status?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      outreach_sequences: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string | null
          email_body: string | null
          email_subject: string | null
          id: string
          scheduled_at: string | null
          sent_at: string | null
          sequence_step: number
          status: string | null
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string | null
          email_body?: string | null
          email_subject?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sequence_step?: number
          status?: string | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string | null
          email_body?: string | null
          email_subject?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sequence_step?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_sequences_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          department: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sales_enablement_assets: {
        Row: {
          content: string | null
          created_at: string | null
          drive_id: string
          drive_url: string
          external: boolean | null
          file_created_date: string | null
          file_name: string
          file_updated_date: string | null
          id: number
          mime_type: string | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          drive_id: string
          drive_url: string
          external?: boolean | null
          file_created_date?: string | null
          file_name: string
          file_updated_date?: string | null
          id?: number
          mime_type?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          drive_id?: string
          drive_url?: string
          external?: boolean | null
          file_created_date?: string | null
          file_name?: string
          file_updated_date?: string | null
          id?: number
          mime_type?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: string
          migration_completed: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          migration_completed?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          migration_completed?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      website_pages: {
        Row: {
          character_count: number | null
          content: string | null
          created_at: string
          description: string | null
          id: string
          original_content: string | null
          processed_at: string | null
          title: string | null
          updated_at: string
          url: string
          word_count: number | null
        }
        Insert: {
          character_count?: number | null
          content?: string | null
          created_at?: string
          description?: string | null
          id?: string
          original_content?: string | null
          processed_at?: string | null
          title?: string | null
          updated_at?: string
          url: string
          word_count?: number | null
        }
        Update: {
          character_count?: number | null
          content?: string | null
          created_at?: string
          description?: string | null
          id?: string
          original_content?: string | null
          processed_at?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          word_count?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      calculate_icp_score: {
        Args: {
          p_annual_revenue: string
          p_cloud_focus: boolean
          p_employee_count: number
          p_industry: string
        }
        Returns: number
      }
      generate_chat_title: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_breach_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          avg_icp_score: number
          breach_date: string
          breach_summary: string
          competitor_companies: number
          id: string
          impacted_companies: number
          title: string
          total_contacts: number
          url: string
        }[]
      }
      get_high_priority_prospects: {
        Args: Record<PropertyKey, never>
        Returns: {
          annual_revenue: string
          breach_article_url: string
          breach_title: string
          company_id: string
          company_name: string
          company_type: string
          contact_id: string
          contact_priority: number
          employee_count: number
          full_name: string
          icp_score: number
          impacted_company_name: string
          industry: string
          outreach_status: string
          title: string
        }[]
      }
      get_user_profiles_with_roles: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          department: string
          email: string
          first_name: string
          last_name: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }[]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      match_documents_competitors: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      match_documents_industry: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      match_documents_news: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      match_documents_sentra: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      match_documents_website: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "marketing" | "sales" | "super_admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "marketing", "sales", "super_admin", "user"],
    },
  },
} as const
