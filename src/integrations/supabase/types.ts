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
      content_plan_items: {
        Row: {
          content: string | null
          created_at: string
          created_by: string
          id: string
          latest_review_id: string | null
          outline: string | null
          research_notes: string | null
          review_status: string | null
          status: string
          strategic_purpose: string
          target_keywords: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by: string
          id?: string
          latest_review_id?: string | null
          outline?: string | null
          research_notes?: string | null
          review_status?: string | null
          status?: string
          strategic_purpose: string
          target_keywords?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string
          id?: string
          latest_review_id?: string | null
          outline?: string | null
          research_notes?: string | null
          review_status?: string | null
          status?: string
          strategic_purpose?: string
          target_keywords?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_plan_items_latest_review_id_fkey"
            columns: ["latest_review_id"]
            isOneToOne: false
            referencedRelation: "content_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reviewer_feedback: {
        Row: {
          created_at: string
          created_by: string
          feedback_instruction: string
          feedback_pattern: string
          feedback_type: string
          id: string
          is_active: boolean
          priority: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          feedback_instruction: string
          feedback_pattern: string
          feedback_type: string
          id?: string
          is_active?: boolean
          priority?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          feedback_instruction?: string
          feedback_pattern?: string
          feedback_type?: string
          id?: string
          is_active?: boolean
          priority?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_reviews: {
        Row: {
          content_item_id: string
          created_at: string
          feedback_applied: boolean
          human_feedback: string | null
          id: string
          overall_score: number | null
          review_result: Json | null
          review_summary: string | null
          reviewer_version: number
          status: string
          updated_at: string
        }
        Insert: {
          content_item_id: string
          created_at?: string
          feedback_applied?: boolean
          human_feedback?: string | null
          id?: string
          overall_score?: number | null
          review_result?: Json | null
          review_summary?: string | null
          reviewer_version?: number
          status?: string
          updated_at?: string
        }
        Update: {
          content_item_id?: string
          created_at?: string
          feedback_applied?: boolean
          human_feedback?: string | null
          id?: string
          overall_score?: number | null
          review_result?: Json | null
          review_summary?: string | null
          reviewer_version?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reviews_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      data_breach_articles: {
        Row: {
          ai_ml_involvement: string | null
          attack_sophistication: string | null
          attack_vector: string | null
          author: string | null
          author_page: string | null
          business_continuity_impact: string | null
          communication_strategy: string | null
          competitive_impact: string | null
          created_at: string
          customer_base_impact: string | null
          customer_trust_impact: string | null
          data_sensitivity_level: string | null
          data_types_exposed: string[] | null
          description: string | null
          downtime_duration: string | null
          emerging_threat_patterns: string[] | null
          estimated_direct_costs: number | null
          external_assistance: string[] | null
          geographic_scope: string | null
          hq_location: string | null
          id: number
          implemented_improvements: string[] | null
          incident_response_actions: string[] | null
          industry_recommendations: string[] | null
          industry_subsector: string | null
          industry_wide_implications: string | null
          insurance_coverage: string | null
          key_takeaways: string[] | null
          keywords: string[] | null
          law_enforcement_involvelment: string[] | null
          litigation_status: string | null
          long_term_financial_impact: string | null
          markdown_content: string | null
          organization_name: string | null
          organization_size: string | null
          policy_changes: string[] | null
          preventability_assessment: string | null
          primary_industry: string | null
          publish_date: string | null
          recommended_controls: string[] | null
          records_compromised: number | null
          regulatory_fines: string | null
          regulatory_framework: string[] | null
          regulatory_scrutiny_level: string | null
          reputational_damage_score: number | null
          response_timeline: string | null
          security_gaps_identifued: string[] | null
          stock_price_impact: string | null
          supply_chain_element: boolean | null
          systems_affected: string[] | null
          technology_solutions_deployed: string[] | null
          threat_actor_name: string | null
          threat_actor_type: string | null
          title: string
          url: string
          vulnerability_type: string | null
          zero_day_exploited: boolean | null
        }
        Insert: {
          ai_ml_involvement?: string | null
          attack_sophistication?: string | null
          attack_vector?: string | null
          author?: string | null
          author_page?: string | null
          business_continuity_impact?: string | null
          communication_strategy?: string | null
          competitive_impact?: string | null
          created_at?: string
          customer_base_impact?: string | null
          customer_trust_impact?: string | null
          data_sensitivity_level?: string | null
          data_types_exposed?: string[] | null
          description?: string | null
          downtime_duration?: string | null
          emerging_threat_patterns?: string[] | null
          estimated_direct_costs?: number | null
          external_assistance?: string[] | null
          geographic_scope?: string | null
          hq_location?: string | null
          id?: number
          implemented_improvements?: string[] | null
          incident_response_actions?: string[] | null
          industry_recommendations?: string[] | null
          industry_subsector?: string | null
          industry_wide_implications?: string | null
          insurance_coverage?: string | null
          key_takeaways?: string[] | null
          keywords?: string[] | null
          law_enforcement_involvelment?: string[] | null
          litigation_status?: string | null
          long_term_financial_impact?: string | null
          markdown_content?: string | null
          organization_name?: string | null
          organization_size?: string | null
          policy_changes?: string[] | null
          preventability_assessment?: string | null
          primary_industry?: string | null
          publish_date?: string | null
          recommended_controls?: string[] | null
          records_compromised?: number | null
          regulatory_fines?: string | null
          regulatory_framework?: string[] | null
          regulatory_scrutiny_level?: string | null
          reputational_damage_score?: number | null
          response_timeline?: string | null
          security_gaps_identifued?: string[] | null
          stock_price_impact?: string | null
          supply_chain_element?: boolean | null
          systems_affected?: string[] | null
          technology_solutions_deployed?: string[] | null
          threat_actor_name?: string | null
          threat_actor_type?: string | null
          title: string
          url: string
          vulnerability_type?: string | null
          zero_day_exploited?: boolean | null
        }
        Update: {
          ai_ml_involvement?: string | null
          attack_sophistication?: string | null
          attack_vector?: string | null
          author?: string | null
          author_page?: string | null
          business_continuity_impact?: string | null
          communication_strategy?: string | null
          competitive_impact?: string | null
          created_at?: string
          customer_base_impact?: string | null
          customer_trust_impact?: string | null
          data_sensitivity_level?: string | null
          data_types_exposed?: string[] | null
          description?: string | null
          downtime_duration?: string | null
          emerging_threat_patterns?: string[] | null
          estimated_direct_costs?: number | null
          external_assistance?: string[] | null
          geographic_scope?: string | null
          hq_location?: string | null
          id?: number
          implemented_improvements?: string[] | null
          incident_response_actions?: string[] | null
          industry_recommendations?: string[] | null
          industry_subsector?: string | null
          industry_wide_implications?: string | null
          insurance_coverage?: string | null
          key_takeaways?: string[] | null
          keywords?: string[] | null
          law_enforcement_involvelment?: string[] | null
          litigation_status?: string | null
          long_term_financial_impact?: string | null
          markdown_content?: string | null
          organization_name?: string | null
          organization_size?: string | null
          policy_changes?: string[] | null
          preventability_assessment?: string | null
          primary_industry?: string | null
          publish_date?: string | null
          recommended_controls?: string[] | null
          records_compromised?: number | null
          regulatory_fines?: string | null
          regulatory_framework?: string[] | null
          regulatory_scrutiny_level?: string | null
          reputational_damage_score?: number | null
          response_timeline?: string | null
          security_gaps_identifued?: string[] | null
          stock_price_impact?: string | null
          supply_chain_element?: boolean | null
          systems_affected?: string[] | null
          technology_solutions_deployed?: string[] | null
          threat_actor_name?: string | null
          threat_actor_type?: string | null
          title?: string
          url?: string
          vulnerability_type?: string | null
          zero_day_exploited?: boolean | null
        }
        Relationships: []
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
          email_validation_reason: string | null
          email_validation_result: Json | null
          email_validation_score: number | null
          email_validation_status: string | null
          enrichment_status: string | null
          event_id: string
          first_name: string
          id: string
          last_name: string
          latest_lead_source: string | null
          latest_lead_source_details: string | null
          lead_exclusion_field: string | null
          lead_status: string | null
          leandata_exclusion: boolean | null
          linkedin: string | null
          mailing_city: string | null
          mailing_country: string | null
          mailing_state_province: string | null
          mailing_street: string | null
          mailing_zip_postal_code: string | null
          manual_owner_email: string | null
          mobile: string | null
          notes: string | null
          phone: string | null
          salesforce_account_id: string | null
          salesforce_account_owner_id: string | null
          salesforce_account_sdr_owner_email: string | null
          salesforce_account_sdr_owner_id: string | null
          salesforce_contact_id: string | null
          salesforce_contact_owner_id: string | null
          salesforce_contact_sdr_owner_id: string | null
          salesforce_lead_id: string | null
          salesforce_owner_id: string | null
          salesforce_sdr_owner_id: string | null
          salesforce_status: string | null
          salesforce_status_detail: string | null
          sf_existing_account: boolean | null
          sf_existing_contact: boolean | null
          sf_existing_customer: boolean | null
          sf_existing_lead: boolean | null
          sf_existing_opportunity: boolean | null
          sync_errors: Json | null
          sync_status: string | null
          title: string | null
          updated_at: string
          validation_errors: Json | null
          validation_status: string | null
          zoominfo_company_country: string | null
          zoominfo_company_state: string | null
          zoominfo_phone_1: string | null
          zoominfo_phone_2: string | null
        }
        Insert: {
          account_name: string
          created_at?: string
          email: string
          email_opt_out?: boolean
          email_validation_reason?: string | null
          email_validation_result?: Json | null
          email_validation_score?: number | null
          email_validation_status?: string | null
          enrichment_status?: string | null
          event_id: string
          first_name: string
          id?: string
          last_name: string
          latest_lead_source?: string | null
          latest_lead_source_details?: string | null
          lead_exclusion_field?: string | null
          lead_status?: string | null
          leandata_exclusion?: boolean | null
          linkedin?: string | null
          mailing_city?: string | null
          mailing_country?: string | null
          mailing_state_province?: string | null
          mailing_street?: string | null
          mailing_zip_postal_code?: string | null
          manual_owner_email?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          salesforce_account_id?: string | null
          salesforce_account_owner_id?: string | null
          salesforce_account_sdr_owner_email?: string | null
          salesforce_account_sdr_owner_id?: string | null
          salesforce_contact_id?: string | null
          salesforce_contact_owner_id?: string | null
          salesforce_contact_sdr_owner_id?: string | null
          salesforce_lead_id?: string | null
          salesforce_owner_id?: string | null
          salesforce_sdr_owner_id?: string | null
          salesforce_status?: string | null
          salesforce_status_detail?: string | null
          sf_existing_account?: boolean | null
          sf_existing_contact?: boolean | null
          sf_existing_customer?: boolean | null
          sf_existing_lead?: boolean | null
          sf_existing_opportunity?: boolean | null
          sync_errors?: Json | null
          sync_status?: string | null
          title?: string | null
          updated_at?: string
          validation_errors?: Json | null
          validation_status?: string | null
          zoominfo_company_country?: string | null
          zoominfo_company_state?: string | null
          zoominfo_phone_1?: string | null
          zoominfo_phone_2?: string | null
        }
        Update: {
          account_name?: string
          created_at?: string
          email?: string
          email_opt_out?: boolean
          email_validation_reason?: string | null
          email_validation_result?: Json | null
          email_validation_score?: number | null
          email_validation_status?: string | null
          enrichment_status?: string | null
          event_id?: string
          first_name?: string
          id?: string
          last_name?: string
          latest_lead_source?: string | null
          latest_lead_source_details?: string | null
          lead_exclusion_field?: string | null
          lead_status?: string | null
          leandata_exclusion?: boolean | null
          linkedin?: string | null
          mailing_city?: string | null
          mailing_country?: string | null
          mailing_state_province?: string | null
          mailing_street?: string | null
          mailing_zip_postal_code?: string | null
          manual_owner_email?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          salesforce_account_id?: string | null
          salesforce_account_owner_id?: string | null
          salesforce_account_sdr_owner_email?: string | null
          salesforce_account_sdr_owner_id?: string | null
          salesforce_contact_id?: string | null
          salesforce_contact_owner_id?: string | null
          salesforce_contact_sdr_owner_id?: string | null
          salesforce_lead_id?: string | null
          salesforce_owner_id?: string | null
          salesforce_sdr_owner_id?: string | null
          salesforce_status?: string | null
          salesforce_status_detail?: string | null
          sf_existing_account?: boolean | null
          sf_existing_contact?: boolean | null
          sf_existing_customer?: boolean | null
          sf_existing_lead?: boolean | null
          sf_existing_opportunity?: boolean | null
          sync_errors?: Json | null
          sync_status?: string | null
          title?: string | null
          updated_at?: string
          validation_errors?: Json | null
          validation_status?: string | null
          zoominfo_company_country?: string | null
          zoominfo_company_state?: string | null
          zoominfo_phone_1?: string | null
          zoominfo_phone_2?: string | null
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
          latest_lead_source: string | null
          latest_lead_source_details: string | null
          name: string
          salesforce_campaign_id: string | null
          salesforce_campaign_url: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          details?: string | null
          end_date: string
          id?: string
          latest_lead_source?: string | null
          latest_lead_source_details?: string | null
          name: string
          salesforce_campaign_id?: string | null
          salesforce_campaign_url?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          details?: string | null
          end_date?: string
          id?: string
          latest_lead_source?: string | null
          latest_lead_source_details?: string | null
          name?: string
          salesforce_campaign_id?: string | null
          salesforce_campaign_url?: string | null
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
      lead_processing_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_stage: string | null
          error_message: string | null
          estimated_completion_time: string | null
          event_id: string
          failed_leads: number
          id: string
          processed_leads: number
          stage: string
          stage_description: string | null
          stage_progress: number | null
          started_at: string | null
          status: string
          total_leads: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_stage?: string | null
          error_message?: string | null
          estimated_completion_time?: string | null
          event_id: string
          failed_leads?: number
          id?: string
          processed_leads?: number
          stage: string
          stage_description?: string | null
          stage_progress?: number | null
          started_at?: string | null
          status?: string
          total_leads?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_stage?: string | null
          error_message?: string | null
          estimated_completion_time?: string | null
          event_id?: string
          failed_leads?: number
          id?: string
          processed_leads?: number
          stage?: string
          stage_description?: string | null
          stage_progress?: number | null
          started_at?: string | null
          status?: string
          total_leads?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_processing_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_research: {
        Row: {
          company_industry: string | null
          company_linkedin: string | null
          company_name: string | null
          company_size: string | null
          company_website: string | null
          created_at: string
          email: string | null
          error_message: string | null
          first_name: string | null
          full_name: string | null
          id: string
          input_type: string
          input_url: string | null
          last_name: string | null
          linkedin_url: string | null
          location: string | null
          raw_linkedin_data: Json | null
          raw_salesforce_data: Json | null
          raw_web_research: Json | null
          research_summary: string | null
          salesforce_id: string | null
          salesforce_object_type: string | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_industry?: string | null
          company_linkedin?: string | null
          company_name?: string | null
          company_size?: string | null
          company_website?: string | null
          created_at?: string
          email?: string | null
          error_message?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          input_type: string
          input_url?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          location?: string | null
          raw_linkedin_data?: Json | null
          raw_salesforce_data?: Json | null
          raw_web_research?: Json | null
          research_summary?: string | null
          salesforce_id?: string | null
          salesforce_object_type?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_industry?: string | null
          company_linkedin?: string | null
          company_name?: string | null
          company_size?: string | null
          company_website?: string | null
          created_at?: string
          email?: string | null
          error_message?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          input_type?: string
          input_url?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          location?: string | null
          raw_linkedin_data?: Json | null
          raw_salesforce_data?: Json | null
          raw_web_research?: Json | null
          research_summary?: string | null
          salesforce_id?: string | null
          salesforce_object_type?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_research_feed: {
        Row: {
          content: string
          created_at: string
          feed_type: string
          id: string
          lead_research_id: string
          published_at: string | null
          raw_data: Json | null
          source_url: string | null
          title: string | null
        }
        Insert: {
          content: string
          created_at?: string
          feed_type: string
          id?: string
          lead_research_id: string
          published_at?: string | null
          raw_data?: Json | null
          source_url?: string | null
          title?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          feed_type?: string
          id?: string
          lead_research_id?: string
          published_at?: string | null
          raw_data?: Json | null
          source_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_research_feed_lead_research_id_fkey"
            columns: ["lead_research_id"]
            isOneToOne: false
            referencedRelation: "lead_research"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard: {
        Row: {
          created_at: string
          id: string
          score: number
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          score: number
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          score?: number
          user_id?: string
          username?: string
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
      post_reviews: {
        Row: {
          audience_quality_score: number | null
          created_at: string | null
          engagement_approach: string | null
          engagement_potential_score: number | null
          estimated_effort: string | null
          id: string
          key_themes: string | null
          post_id: string
          problem_fit_score: number | null
          reasoning: string | null
          recommendation: string | null
          relevance_score: number | null
          risk_flags: string | null
          sentra_angles: string | null
          strategic_value_score: number | null
          subreddit_context: string | null
          suggested_tone: string | null
          timing_score: number | null
          updated_at: string | null
        }
        Insert: {
          audience_quality_score?: number | null
          created_at?: string | null
          engagement_approach?: string | null
          engagement_potential_score?: number | null
          estimated_effort?: string | null
          id?: string
          key_themes?: string | null
          post_id: string
          problem_fit_score?: number | null
          reasoning?: string | null
          recommendation?: string | null
          relevance_score?: number | null
          risk_flags?: string | null
          sentra_angles?: string | null
          strategic_value_score?: number | null
          subreddit_context?: string | null
          suggested_tone?: string | null
          timing_score?: number | null
          updated_at?: string | null
        }
        Update: {
          audience_quality_score?: number | null
          created_at?: string | null
          engagement_approach?: string | null
          engagement_potential_score?: number | null
          estimated_effort?: string | null
          id?: string
          key_themes?: string | null
          post_id?: string
          problem_fit_score?: number | null
          reasoning?: string | null
          recommendation?: string | null
          relevance_score?: number | null
          risk_flags?: string | null
          sentra_angles?: string | null
          strategic_value_score?: number | null
          subreddit_context?: string | null
          suggested_tone?: string | null
          timing_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_reviews_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "reddit_posts"
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
      reddit_posts: {
        Row: {
          author: string | null
          comment_count: number | null
          comments_fetched_at: string | null
          content: string | null
          content_snippet: string | null
          created_at: string | null
          id: string
          iso_date: string | null
          keyword_id: string | null
          link: string
          pub_date: string | null
          reddit_id: string
          source_type: string | null
          subreddit_id: string | null
          title: string
          top_comments: Json | null
          updated_at: string | null
          upvotes: number | null
        }
        Insert: {
          author?: string | null
          comment_count?: number | null
          comments_fetched_at?: string | null
          content?: string | null
          content_snippet?: string | null
          created_at?: string | null
          id?: string
          iso_date?: string | null
          keyword_id?: string | null
          link: string
          pub_date?: string | null
          reddit_id: string
          source_type?: string | null
          subreddit_id?: string | null
          title: string
          top_comments?: Json | null
          updated_at?: string | null
          upvotes?: number | null
        }
        Update: {
          author?: string | null
          comment_count?: number | null
          comments_fetched_at?: string | null
          content?: string | null
          content_snippet?: string | null
          created_at?: string | null
          id?: string
          iso_date?: string | null
          keyword_id?: string | null
          link?: string
          pub_date?: string | null
          reddit_id?: string
          source_type?: string | null
          subreddit_id?: string | null
          title?: string
          top_comments?: Json | null
          updated_at?: string | null
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reddit_posts_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "tracked_keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reddit_posts_subreddit_id_fkey"
            columns: ["subreddit_id"]
            isOneToOne: false
            referencedRelation: "tracked_subreddits"
            referencedColumns: ["id"]
          },
        ]
      }
      reddit_profile_activity: {
        Row: {
          activity_type: string
          content: string | null
          created_at: string | null
          id: string
          num_comments: number | null
          permalink: string | null
          posted_at: string | null
          profile_id: string
          reddit_id: string
          score: number | null
          subreddit: string | null
          title: string | null
        }
        Insert: {
          activity_type: string
          content?: string | null
          created_at?: string | null
          id?: string
          num_comments?: number | null
          permalink?: string | null
          posted_at?: string | null
          profile_id: string
          reddit_id: string
          score?: number | null
          subreddit?: string | null
          title?: string | null
        }
        Update: {
          activity_type?: string
          content?: string | null
          created_at?: string | null
          id?: string
          num_comments?: number | null
          permalink?: string | null
          posted_at?: string | null
          profile_id?: string
          reddit_id?: string
          score?: number | null
          subreddit?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reddit_profile_activity_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "reddit_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reddit_profiles: {
        Row: {
          account_created_at: string | null
          avatar_url: string | null
          comment_karma: number | null
          created_at: string | null
          description: string | null
          display_name: string | null
          expertise_areas: string[] | null
          id: string
          is_active: boolean | null
          is_premium: boolean | null
          is_verified: boolean | null
          last_synced_at: string | null
          link_karma: number | null
          persona_generated_at: string | null
          persona_summary: string | null
          profile_type: string
          profile_url: string | null
          reddit_username: string
          total_karma: number | null
          typical_tone: string | null
          updated_at: string | null
          user_id: string
          writing_style: string | null
        }
        Insert: {
          account_created_at?: string | null
          avatar_url?: string | null
          comment_karma?: number | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          expertise_areas?: string[] | null
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          last_synced_at?: string | null
          link_karma?: number | null
          persona_generated_at?: string | null
          persona_summary?: string | null
          profile_type?: string
          profile_url?: string | null
          reddit_username: string
          total_karma?: number | null
          typical_tone?: string | null
          updated_at?: string | null
          user_id: string
          writing_style?: string | null
        }
        Update: {
          account_created_at?: string | null
          avatar_url?: string | null
          comment_karma?: number | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          expertise_areas?: string[] | null
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          last_synced_at?: string | null
          link_karma?: number | null
          persona_generated_at?: string | null
          persona_summary?: string | null
          profile_type?: string
          profile_url?: string | null
          reddit_username?: string
          total_karma?: number | null
          typical_tone?: string | null
          updated_at?: string | null
          user_id?: string
          writing_style?: string | null
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
      suggested_replies: {
        Row: {
          created_at: string | null
          edited_reply: string | null
          id: string
          notes: string | null
          post_id: string
          posted_at: string | null
          posted_by: string | null
          review_id: string | null
          status: string | null
          suggested_reply: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          edited_reply?: string | null
          id?: string
          notes?: string | null
          post_id: string
          posted_at?: string | null
          posted_by?: string | null
          review_id?: string | null
          status?: string | null
          suggested_reply: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          edited_reply?: string | null
          id?: string
          notes?: string | null
          post_id?: string
          posted_at?: string | null
          posted_by?: string | null
          review_id?: string | null
          status?: string | null
          suggested_reply?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggested_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "reddit_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggested_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "post_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_keywords: {
        Row: {
          created_at: string | null
          fetch_frequency_minutes: number | null
          id: string
          is_active: boolean | null
          keyword: string
          last_fetched_at: string | null
          negative_keywords: string[] | null
          search_comments: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fetch_frequency_minutes?: number | null
          id?: string
          is_active?: boolean | null
          keyword: string
          last_fetched_at?: string | null
          negative_keywords?: string[] | null
          search_comments?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fetch_frequency_minutes?: number | null
          id?: string
          is_active?: boolean | null
          keyword?: string
          last_fetched_at?: string | null
          negative_keywords?: string[] | null
          search_comments?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tracked_subreddits: {
        Row: {
          created_at: string | null
          fetch_comments: boolean | null
          fetch_frequency_minutes: number | null
          id: string
          is_active: boolean | null
          last_fetched_at: string | null
          rss_url: string
          subreddit_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fetch_comments?: boolean | null
          fetch_frequency_minutes?: number | null
          id?: string
          is_active?: boolean | null
          last_fetched_at?: string | null
          rss_url: string
          subreddit_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fetch_comments?: boolean | null
          fetch_frequency_minutes?: number | null
          id?: string
          is_active?: boolean | null
          last_fetched_at?: string | null
          rss_url?: string
          subreddit_name?: string
          updated_at?: string | null
          user_id?: string
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
      calculate_icp_score: {
        Args: {
          p_annual_revenue: string
          p_cloud_focus: boolean
          p_employee_count: number
          p_industry: string
        }
        Returns: number
      }
      documents_news: {
        Args: { filter: Json; match_count: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      generate_chat_title: { Args: never; Returns: string }
      get_breach_summary: {
        Args: never
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
        Args: never
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
        Args: never
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
