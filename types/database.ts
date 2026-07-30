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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_audit_events: {
        Row: {
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          reason: string | null
        }
        Insert: {
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          reason?: string | null
        }
        Update: {
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      ad_billing_snapshots: {
        Row: {
          billable_clicks: number
          billable_impressions: number
          billable_spend: number
          billable_viewable_impressions: number
          campaign_id: string
          created_at: string
          currency: string
          filtered_event_count: number
          flight_id: string | null
          gross_spend: number
          id: string
          period_end: string
          period_start: string
          pricing_model: Database["public"]["Enums"]["ad_pricing_model"]
        }
        Insert: {
          billable_clicks?: number
          billable_impressions?: number
          billable_spend?: number
          billable_viewable_impressions?: number
          campaign_id: string
          created_at?: string
          currency: string
          filtered_event_count?: number
          flight_id?: string | null
          gross_spend?: number
          id?: string
          period_end: string
          period_start: string
          pricing_model: Database["public"]["Enums"]["ad_pricing_model"]
        }
        Update: {
          billable_clicks?: number
          billable_impressions?: number
          billable_spend?: number
          billable_viewable_impressions?: number
          campaign_id?: string
          created_at?: string
          currency?: string
          filtered_event_count?: number
          flight_id?: string | null
          gross_spend?: number
          id?: string
          period_end?: string
          period_start?: string
          pricing_model?: Database["public"]["Enums"]["ad_pricing_model"]
        }
        Relationships: [
          {
            foreignKeyName: "ad_billing_snapshots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_billing_snapshots_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "ad_flights"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          allow_overspend: boolean
          billable_budget_amount: number | null
          budget_label: string | null
          campaign_type: Database["public"]["Enums"]["ad_campaign_type"]
          competitor_exclusion_keys: string[]
          contracted_clicks: number | null
          contracted_impressions: number | null
          contracted_viewable_impressions: number | null
          created_at: string
          currency: string
          ends_at: string | null
          excluded_content_tags: string[]
          excluded_course_categories: string[]
          excluded_course_ids: string[]
          excluded_lesson_ids: string[]
          excluded_page_types: string[]
          gross_budget_amount: number | null
          id: string
          included_content_tags: string[]
          included_course_categories: string[]
          included_course_ids: string[]
          included_lesson_ids: string[]
          make_good_policy: string | null
          minor_unit: number
          name: string
          notes: string | null
          overspend_tolerance_percent: number
          pacing_mode: Database["public"]["Enums"]["ad_pacing_mode"]
          partner_id: string
          pricing_model: Database["public"]["Enums"]["ad_pricing_model"]
          priority: number
          rate_amount: number
          rounding_mode: string
          spend_cap_amount: number | null
          starts_at: string | null
          status: Database["public"]["Enums"]["ad_entity_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          allow_overspend?: boolean
          billable_budget_amount?: number | null
          budget_label?: string | null
          campaign_type?: Database["public"]["Enums"]["ad_campaign_type"]
          competitor_exclusion_keys?: string[]
          contracted_clicks?: number | null
          contracted_impressions?: number | null
          contracted_viewable_impressions?: number | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          excluded_content_tags?: string[]
          excluded_course_categories?: string[]
          excluded_course_ids?: string[]
          excluded_lesson_ids?: string[]
          excluded_page_types?: string[]
          gross_budget_amount?: number | null
          id: string
          included_content_tags?: string[]
          included_course_categories?: string[]
          included_course_ids?: string[]
          included_lesson_ids?: string[]
          make_good_policy?: string | null
          minor_unit?: number
          name: string
          notes?: string | null
          overspend_tolerance_percent?: number
          pacing_mode?: Database["public"]["Enums"]["ad_pacing_mode"]
          partner_id: string
          pricing_model?: Database["public"]["Enums"]["ad_pricing_model"]
          priority?: number
          rate_amount?: number
          rounding_mode?: string
          spend_cap_amount?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["ad_entity_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          allow_overspend?: boolean
          billable_budget_amount?: number | null
          budget_label?: string | null
          campaign_type?: Database["public"]["Enums"]["ad_campaign_type"]
          competitor_exclusion_keys?: string[]
          contracted_clicks?: number | null
          contracted_impressions?: number | null
          contracted_viewable_impressions?: number | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          excluded_content_tags?: string[]
          excluded_course_categories?: string[]
          excluded_course_ids?: string[]
          excluded_lesson_ids?: string[]
          excluded_page_types?: string[]
          gross_budget_amount?: number | null
          id?: string
          included_content_tags?: string[]
          included_course_categories?: string[]
          included_course_ids?: string[]
          included_lesson_ids?: string[]
          make_good_policy?: string | null
          minor_unit?: number
          name?: string
          notes?: string | null
          overspend_tolerance_percent?: number
          pacing_mode?: Database["public"]["Enums"]["ad_pacing_mode"]
          partner_id?: string
          pricing_model?: Database["public"]["Enums"]["ad_pricing_model"]
          priority?: number
          rate_amount?: number
          rounding_mode?: string
          spend_cap_amount?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["ad_entity_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "ad_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_creative_assets: {
        Row: {
          alt_text: string | null
          asset_type: Database["public"]["Enums"]["ad_asset_type"]
          checksum: string | null
          created_at: string
          duration_seconds: number | null
          file_size_bytes: number
          height: number | null
          id: string
          mime_type: string
          partner_id: string | null
          public_url: string | null
          status: Database["public"]["Enums"]["ad_entity_status"]
          storage_bucket: string
          storage_path: string
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          asset_type: Database["public"]["Enums"]["ad_asset_type"]
          checksum?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes: number
          height?: number | null
          id?: string
          mime_type: string
          partner_id?: string | null
          public_url?: string | null
          status?: Database["public"]["Enums"]["ad_entity_status"]
          storage_bucket?: string
          storage_path: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          asset_type?: Database["public"]["Enums"]["ad_asset_type"]
          checksum?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number
          height?: number | null
          id?: string
          mime_type?: string
          partner_id?: string | null
          public_url?: string | null
          status?: Database["public"]["Enums"]["ad_entity_status"]
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_creative_assets_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "ad_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_creative_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string | null
          caption_asset_id: string | null
          created_at: string
          created_by: string | null
          creative_id: string
          cta_label: string | null
          cta_url: string | null
          disclosure_label: string
          eyebrow: string | null
          headline: string | null
          id: string
          image_alt: string | null
          image_asset_id: string | null
          legal_text: string | null
          logo_asset_id: string | null
          pause_reason: string | null
          paused_at: string | null
          paused_by: string | null
          poster_asset_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          sponsor_label: string
          status: Database["public"]["Enums"]["ad_entity_status"]
          submitted_at: string | null
          submitted_by: string | null
          theme: Json
          version_number: number
          video_asset_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string | null
          caption_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          creative_id: string
          cta_label?: string | null
          cta_url?: string | null
          disclosure_label?: string
          eyebrow?: string | null
          headline?: string | null
          id?: string
          image_alt?: string | null
          image_asset_id?: string | null
          legal_text?: string | null
          logo_asset_id?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          paused_by?: string | null
          poster_asset_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          sponsor_label: string
          status?: Database["public"]["Enums"]["ad_entity_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          theme?: Json
          version_number: number
          video_asset_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string | null
          caption_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          creative_id?: string
          cta_label?: string | null
          cta_url?: string | null
          disclosure_label?: string
          eyebrow?: string | null
          headline?: string | null
          id?: string
          image_alt?: string | null
          image_asset_id?: string | null
          legal_text?: string | null
          logo_asset_id?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          paused_by?: string | null
          poster_asset_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          sponsor_label?: string
          status?: Database["public"]["Enums"]["ad_entity_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          theme?: Json
          version_number?: number
          video_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_creative_versions_caption_asset_id_fkey"
            columns: ["caption_asset_id"]
            isOneToOne: false
            referencedRelation: "ad_creative_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_creative_versions_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "ad_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_creative_versions_image_asset_id_fkey"
            columns: ["image_asset_id"]
            isOneToOne: false
            referencedRelation: "ad_creative_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_creative_versions_logo_asset_id_fkey"
            columns: ["logo_asset_id"]
            isOneToOne: false
            referencedRelation: "ad_creative_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_creative_versions_poster_asset_id_fkey"
            columns: ["poster_asset_id"]
            isOneToOne: false
            referencedRelation: "ad_creative_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_creative_versions_video_asset_id_fkey"
            columns: ["video_asset_id"]
            isOneToOne: false
            referencedRelation: "ad_creative_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_creatives: {
        Row: {
          campaign_id: string
          created_at: string
          creative_format: Database["public"]["Enums"]["ad_creative_format"]
          current_version_id: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["ad_entity_status"]
          updated_at: string
          weight: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          creative_format?: Database["public"]["Enums"]["ad_creative_format"]
          current_version_id?: string | null
          id: string
          name: string
          status?: Database["public"]["Enums"]["ad_entity_status"]
          updated_at?: string
          weight?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          creative_format?: Database["public"]["Enums"]["ad_creative_format"]
          current_version_id?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["ad_entity_status"]
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_creatives_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "ad_creative_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_decisions: {
        Row: {
          created_at: string
          decision_context: Json
          eligible_flight_count: number
          experiment_key: string | null
          id: string
          ineligible_reasons: Json
          placement_key: string
          request_key: string | null
          score_breakdown: Json
          selected_campaign_id: string | null
          selected_creative_id: string | null
          selected_creative_version_id: string | null
          selected_flight_id: string | null
          selected_partner_id: string | null
          session_key_hash: string | null
          user_id: string | null
          variant_key: string | null
        }
        Insert: {
          created_at?: string
          decision_context?: Json
          eligible_flight_count?: number
          experiment_key?: string | null
          id?: string
          ineligible_reasons?: Json
          placement_key: string
          request_key?: string | null
          score_breakdown?: Json
          selected_campaign_id?: string | null
          selected_creative_id?: string | null
          selected_creative_version_id?: string | null
          selected_flight_id?: string | null
          selected_partner_id?: string | null
          session_key_hash?: string | null
          user_id?: string | null
          variant_key?: string | null
        }
        Update: {
          created_at?: string
          decision_context?: Json
          eligible_flight_count?: number
          experiment_key?: string | null
          id?: string
          ineligible_reasons?: Json
          placement_key?: string
          request_key?: string | null
          score_breakdown?: Json
          selected_campaign_id?: string | null
          selected_creative_id?: string | null
          selected_creative_version_id?: string | null
          selected_flight_id?: string | null
          selected_partner_id?: string | null
          session_key_hash?: string | null
          user_id?: string | null
          variant_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_decisions_placement_key_fkey"
            columns: ["placement_key"]
            isOneToOne: false
            referencedRelation: "ad_placements"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "ad_decisions_selected_campaign_id_fkey"
            columns: ["selected_campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_decisions_selected_creative_id_fkey"
            columns: ["selected_creative_id"]
            isOneToOne: false
            referencedRelation: "ad_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_decisions_selected_creative_version_id_fkey"
            columns: ["selected_creative_version_id"]
            isOneToOne: false
            referencedRelation: "ad_creative_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_decisions_selected_flight_id_fkey"
            columns: ["selected_flight_id"]
            isOneToOne: false
            referencedRelation: "ad_flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_decisions_selected_partner_id_fkey"
            columns: ["selected_partner_id"]
            isOneToOne: false
            referencedRelation: "ad_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_event_daily_summaries: {
        Row: {
          billable_clicks: number
          billable_spend: number
          billable_viewable_impressions: number
          campaign_id: string | null
          created_at: string
          creative_id: string | null
          creative_version_id: string | null
          filtered_events: number
          flight_id: string | null
          gross_impressions: number
          id: string
          partner_id: string | null
          placement_key: string | null
          qualified_impressions: number
          summary_date: string
          timezone: string
          updated_at: string
        }
        Insert: {
          billable_clicks?: number
          billable_spend?: number
          billable_viewable_impressions?: number
          campaign_id?: string | null
          created_at?: string
          creative_id?: string | null
          creative_version_id?: string | null
          filtered_events?: number
          flight_id?: string | null
          gross_impressions?: number
          id?: string
          partner_id?: string | null
          placement_key?: string | null
          qualified_impressions?: number
          summary_date: string
          timezone: string
          updated_at?: string
        }
        Update: {
          billable_clicks?: number
          billable_spend?: number
          billable_viewable_impressions?: number
          campaign_id?: string | null
          created_at?: string
          creative_id?: string | null
          creative_version_id?: string | null
          filtered_events?: number
          flight_id?: string | null
          gross_impressions?: number
          id?: string
          partner_id?: string | null
          placement_key?: string | null
          qualified_impressions?: number
          summary_date?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_event_daily_summaries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_event_daily_summaries_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "ad_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_event_daily_summaries_creative_version_id_fkey"
            columns: ["creative_version_id"]
            isOneToOne: false
            referencedRelation: "ad_creative_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_event_daily_summaries_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "ad_flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_event_daily_summaries_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "ad_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_event_daily_summaries_placement_key_fkey"
            columns: ["placement_key"]
            isOneToOne: false
            referencedRelation: "ad_placements"
            referencedColumns: ["key"]
          },
        ]
      }
      ad_events: {
        Row: {
          billable_amount: number
          campaign_id: string | null
          client_event_time: string | null
          course_id: string | null
          created_at: string
          creative_id: string | null
          creative_version_id: string | null
          decision_id: string | null
          device_hash: string | null
          event_dedupe_key: string | null
          event_type: Database["public"]["Enums"]["ad_event_type"]
          flight_id: string | null
          id: string
          ip_hash: string | null
          ivt_reason: string | null
          lesson_id: string | null
          metadata: Json
          page_id: string | null
          page_number: number | null
          partner_id: string | null
          placement_key: string
          qualification_status: Database["public"]["Enums"]["ad_qualification_status"]
          risk_score: number
          route: string | null
          segment_keys: string[]
          server_received_at: string
          session_key_hash: string | null
          user_agent_hash: string | null
          user_id: string | null
        }
        Insert: {
          billable_amount?: number
          campaign_id?: string | null
          client_event_time?: string | null
          course_id?: string | null
          created_at?: string
          creative_id?: string | null
          creative_version_id?: string | null
          decision_id?: string | null
          device_hash?: string | null
          event_dedupe_key?: string | null
          event_type: Database["public"]["Enums"]["ad_event_type"]
          flight_id?: string | null
          id?: string
          ip_hash?: string | null
          ivt_reason?: string | null
          lesson_id?: string | null
          metadata?: Json
          page_id?: string | null
          page_number?: number | null
          partner_id?: string | null
          placement_key: string
          qualification_status?: Database["public"]["Enums"]["ad_qualification_status"]
          risk_score?: number
          route?: string | null
          segment_keys?: string[]
          server_received_at?: string
          session_key_hash?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Update: {
          billable_amount?: number
          campaign_id?: string | null
          client_event_time?: string | null
          course_id?: string | null
          created_at?: string
          creative_id?: string | null
          creative_version_id?: string | null
          decision_id?: string | null
          device_hash?: string | null
          event_dedupe_key?: string | null
          event_type?: Database["public"]["Enums"]["ad_event_type"]
          flight_id?: string | null
          id?: string
          ip_hash?: string | null
          ivt_reason?: string | null
          lesson_id?: string | null
          metadata?: Json
          page_id?: string | null
          page_number?: number | null
          partner_id?: string | null
          placement_key?: string
          qualification_status?: Database["public"]["Enums"]["ad_qualification_status"]
          risk_score?: number
          route?: string | null
          segment_keys?: string[]
          server_received_at?: string
          session_key_hash?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_events_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "ad_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_events_creative_version_id_fkey"
            columns: ["creative_version_id"]
            isOneToOne: false
            referencedRelation: "ad_creative_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_events_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "ad_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_events_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "ad_flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "ad_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_events_placement_key_fkey"
            columns: ["placement_key"]
            isOneToOne: false
            referencedRelation: "ad_placements"
            referencedColumns: ["key"]
          },
        ]
      }
      ad_flights: {
        Row: {
          brand_safety_rules: Json
          campaign_id: string
          competitor_exclusion_keys: string[]
          created_at: string
          creative_id: string
          creative_version_id: string
          delivery_goal_clicks: number | null
          delivery_goal_impressions: number | null
          ends_at: string | null
          frequency_caps: Json
          id: string
          placement_key: string
          priority: number
          sequence_rules: Json
          starts_at: string | null
          status: Database["public"]["Enums"]["ad_entity_status"]
          targeting_rules: Json
          updated_at: string
          weight: number
        }
        Insert: {
          brand_safety_rules?: Json
          campaign_id: string
          competitor_exclusion_keys?: string[]
          created_at?: string
          creative_id: string
          creative_version_id: string
          delivery_goal_clicks?: number | null
          delivery_goal_impressions?: number | null
          ends_at?: string | null
          frequency_caps?: Json
          id?: string
          placement_key: string
          priority?: number
          sequence_rules?: Json
          starts_at?: string | null
          status?: Database["public"]["Enums"]["ad_entity_status"]
          targeting_rules?: Json
          updated_at?: string
          weight?: number
        }
        Update: {
          brand_safety_rules?: Json
          campaign_id?: string
          competitor_exclusion_keys?: string[]
          created_at?: string
          creative_id?: string
          creative_version_id?: string
          delivery_goal_clicks?: number | null
          delivery_goal_impressions?: number | null
          ends_at?: string | null
          frequency_caps?: Json
          id?: string
          placement_key?: string
          priority?: number
          sequence_rules?: Json
          starts_at?: string | null
          status?: Database["public"]["Enums"]["ad_entity_status"]
          targeting_rules?: Json
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_flights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_flights_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "ad_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_flights_creative_version_id_fkey"
            columns: ["creative_version_id"]
            isOneToOne: false
            referencedRelation: "ad_creative_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_flights_placement_key_fkey"
            columns: ["placement_key"]
            isOneToOne: false
            referencedRelation: "ad_placements"
            referencedColumns: ["key"]
          },
        ]
      }
      ad_frequency_counters: {
        Row: {
          campaign_id: string | null
          click_count: number
          creative_id: string | null
          creative_version_id: string | null
          id: string
          impression_count: number
          partner_id: string | null
          placement_key: string | null
          scope_key_hash: string
          scope_type: Database["public"]["Enums"]["ad_frequency_scope_type"]
          timezone: string
          updated_at: string
          viewable_impression_count: number
          window_end: string
          window_name: string
          window_start: string
          window_type: Database["public"]["Enums"]["ad_frequency_window_type"]
        }
        Insert: {
          campaign_id?: string | null
          click_count?: number
          creative_id?: string | null
          creative_version_id?: string | null
          id?: string
          impression_count?: number
          partner_id?: string | null
          placement_key?: string | null
          scope_key_hash: string
          scope_type: Database["public"]["Enums"]["ad_frequency_scope_type"]
          timezone?: string
          updated_at?: string
          viewable_impression_count?: number
          window_end: string
          window_name: string
          window_start: string
          window_type?: Database["public"]["Enums"]["ad_frequency_window_type"]
        }
        Update: {
          campaign_id?: string | null
          click_count?: number
          creative_id?: string | null
          creative_version_id?: string | null
          id?: string
          impression_count?: number
          partner_id?: string | null
          placement_key?: string | null
          scope_key_hash?: string
          scope_type?: Database["public"]["Enums"]["ad_frequency_scope_type"]
          timezone?: string
          updated_at?: string
          viewable_impression_count?: number
          window_end?: string
          window_name?: string
          window_start?: string
          window_type?: Database["public"]["Enums"]["ad_frequency_window_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ad_frequency_counters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_frequency_counters_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "ad_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_frequency_counters_creative_version_id_fkey"
            columns: ["creative_version_id"]
            isOneToOne: false
            referencedRelation: "ad_creative_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_frequency_counters_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "ad_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_frequency_counters_placement_key_fkey"
            columns: ["placement_key"]
            isOneToOne: false
            referencedRelation: "ad_placements"
            referencedColumns: ["key"]
          },
        ]
      }
      ad_house_fallback_events: {
        Row: {
          client_event_time: string | null
          created_at: string
          device_hash: string | null
          event_dedupe_key: string | null
          event_type: string
          fallback_key: string
          id: string
          ip_hash: string | null
          metadata: Json
          placement_key: string
          route: string | null
          server_received_at: string
          session_key_hash: string | null
          user_agent_hash: string | null
          user_id: string | null
        }
        Insert: {
          client_event_time?: string | null
          created_at?: string
          device_hash?: string | null
          event_dedupe_key?: string | null
          event_type: string
          fallback_key: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          placement_key: string
          route?: string | null
          server_received_at?: string
          session_key_hash?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Update: {
          client_event_time?: string | null
          created_at?: string
          device_hash?: string | null
          event_dedupe_key?: string | null
          event_type?: string
          fallback_key?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          placement_key?: string
          route?: string | null
          server_received_at?: string
          session_key_hash?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_house_fallback_events_placement_key_fkey"
            columns: ["placement_key"]
            isOneToOne: false
            referencedRelation: "ad_placements"
            referencedColumns: ["key"]
          },
        ]
      }
      ad_make_goods: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          notes: string | null
          owed_clicks: number
          owed_impressions: number
          owed_value_amount: number
          reason: string
          status: Database["public"]["Enums"]["ad_entity_status"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          notes?: string | null
          owed_clicks?: number
          owed_impressions?: number
          owed_value_amount?: number
          reason: string
          status?: Database["public"]["Enums"]["ad_entity_status"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          owed_clicks?: number
          owed_impressions?: number
          owed_value_amount?: number
          reason?: string
          status?: Database["public"]["Enums"]["ad_entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_make_goods_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_partners: {
        Row: {
          allowed_cta_domains: string[]
          contact_email: string | null
          contact_name: string | null
          contract_reference: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          slug: string
          status: Database["public"]["Enums"]["ad_entity_status"]
          terms_accepted_at: string | null
          terms_accepted_by: string | null
          terms_version: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          allowed_cta_domains?: string[]
          contact_email?: string | null
          contact_name?: string | null
          contract_reference?: string | null
          created_at?: string
          id: string
          name: string
          notes?: string | null
          slug: string
          status?: Database["public"]["Enums"]["ad_entity_status"]
          terms_accepted_at?: string | null
          terms_accepted_by?: string | null
          terms_version?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          allowed_cta_domains?: string[]
          contact_email?: string | null
          contact_name?: string | null
          contract_reference?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["ad_entity_status"]
          terms_accepted_at?: string | null
          terms_accepted_by?: string | null
          terms_version?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      ad_placements: {
        Row: {
          allowed_creative_formats: Database["public"]["Enums"]["ad_creative_format"][]
          created_at: string
          default_frequency_cap: Json
          house_fallback_body: string
          house_fallback_cta_label: string
          house_fallback_cta_url: string
          house_fallback_enabled: boolean
          house_fallback_eyebrow: string
          house_fallback_headline: string
          key: string
          max_ads_per_view: number
          max_asset_weight_kb: number | null
          name: string
          required_asset_aspect_ratio: string | null
          route_pattern: string
          status: Database["public"]["Enums"]["ad_entity_status"]
          supports_sequence: boolean
          supports_video: boolean
          surface: string
          updated_at: string
        }
        Insert: {
          allowed_creative_formats?: Database["public"]["Enums"]["ad_creative_format"][]
          created_at?: string
          default_frequency_cap?: Json
          house_fallback_body?: string
          house_fallback_cta_label?: string
          house_fallback_cta_url?: string
          house_fallback_enabled?: boolean
          house_fallback_eyebrow?: string
          house_fallback_headline?: string
          key: string
          max_ads_per_view?: number
          max_asset_weight_kb?: number | null
          name: string
          required_asset_aspect_ratio?: string | null
          route_pattern: string
          status?: Database["public"]["Enums"]["ad_entity_status"]
          supports_sequence?: boolean
          supports_video?: boolean
          surface: string
          updated_at?: string
        }
        Update: {
          allowed_creative_formats?: Database["public"]["Enums"]["ad_creative_format"][]
          created_at?: string
          default_frequency_cap?: Json
          house_fallback_body?: string
          house_fallback_cta_label?: string
          house_fallback_cta_url?: string
          house_fallback_enabled?: boolean
          house_fallback_eyebrow?: string
          house_fallback_headline?: string
          key?: string
          max_ads_per_view?: number
          max_asset_weight_kb?: number | null
          name?: string
          required_asset_aspect_ratio?: string | null
          route_pattern?: string
          status?: Database["public"]["Enums"]["ad_entity_status"]
          supports_sequence?: boolean
          supports_video?: boolean
          surface?: string
          updated_at?: string
        }
        Relationships: []
      }
      ad_sponsor_inquiries: {
        Row: {
          budget_range: string | null
          campaign_goal: string
          contact_name: string
          created_at: string
          email: string
          id: string
          metadata: Json
          organization_name: string
          placement_interest: string | null
          role_title: string | null
          source: string
          status: string
          timing: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          budget_range?: string | null
          campaign_goal: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          metadata?: Json
          organization_name: string
          placement_interest?: string | null
          role_title?: string | null
          source?: string
          status?: string
          timing?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          budget_range?: string | null
          campaign_goal?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          metadata?: Json
          organization_name?: string
          placement_interest?: string | null
          role_title?: string | null
          source?: string
          status?: string
          timing?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      ad_traffic_quality_events: {
        Row: {
          ad_event_id: string | null
          created_at: string
          device_hash: string | null
          id: string
          ip_hash: string | null
          metadata: Json
          reason: string
          rule_key: string
          session_key_hash: string | null
          severity: number
          user_id: string | null
        }
        Insert: {
          ad_event_id?: string | null
          created_at?: string
          device_hash?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json
          reason: string
          rule_key: string
          session_key_hash?: string | null
          severity?: number
          user_id?: string | null
        }
        Update: {
          ad_event_id?: string | null
          created_at?: string
          device_hash?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json
          reason?: string
          rule_key?: string
          session_key_hash?: string | null
          severity?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_traffic_quality_events_ad_event_id_fkey"
            columns: ["ad_event_id"]
            isOneToOne: false
            referencedRelation: "ad_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_course_plans: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string | null
          generated_plan: Json
          id: string
          input_prompt: string
          mode: string
          selected_items: Json
          status: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          generated_plan?: Json
          id?: string
          input_prompt: string
          mode: string
          selected_items?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          generated_plan?: Json
          id?: string
          input_prompt?: string
          mode?: string
          selected_items?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_course_plans_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generation_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string
          error: string | null
          id: string
          job_type: string
          prompt: Json
          result: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type: string
          error?: string | null
          id?: string
          job_type: string
          prompt?: Json
          result?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          error?: string | null
          id?: string
          job_type?: string
          prompt?: Json
          result?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      assessment_option_dimension_weights: {
        Row: {
          dimension_id: string
          option_id: string
          weight: number
        }
        Insert: {
          dimension_id: string
          option_id: string
          weight: number
        }
        Update: {
          dimension_id?: string
          option_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_option_dimension_weights_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "value_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_option_dimension_weights_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "assessment_question_options"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_question_options: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          question_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          question_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_version_id: string
          created_at: string
          helper_text: string | null
          id: string
          prompt: string
          question_type: string
          sort_order: number
        }
        Insert: {
          assessment_version_id: string
          created_at?: string
          helper_text?: string | null
          id?: string
          prompt: string
          question_type?: string
          sort_order?: number
        }
        Update: {
          assessment_version_id?: string
          created_at?: string
          helper_text?: string | null
          id?: string
          prompt?: string
          question_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_version_id_fkey"
            columns: ["assessment_version_id"]
            isOneToOne: false
            referencedRelation: "assessment_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_versions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          published_at: string | null
          slug: string
          status: string
          title: string
          xp_award: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          published_at?: string | null
          slug: string
          status?: string
          title: string
          xp_award?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          xp_award?: number
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          metadata: Json
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      blocked_email_domains: {
        Row: {
          created_at: string
          domain: string
          reason: string
        }
        Insert: {
          created_at?: string
          domain: string
          reason?: string
        }
        Update: {
          created_at?: string
          domain?: string
          reason?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          budget_amount: number | null
          budget_label: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          name: string
          slug: string
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget_amount?: number | null
          budget_label?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id: string
          name: string
          slug: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget_amount?: number | null
          budget_label?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          slug?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_value_tags: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          dimension_id: string
          id: string
          outcome_type: string | null
          recommended_level: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          dimension_id: string
          id?: string
          outcome_type?: string | null
          recommended_level?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          dimension_id?: string
          id?: string
          outcome_type?: string | null
          recommended_level?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_value_tags_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "value_dimensions"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          ai_generated: boolean
          ai_generation_notes: Json
          ai_media_status: string
          ai_publish_status: string
          ai_text_status: string
          category: string
          created_at: string
          description: string
          estimated_minutes: number
          id: string
          level: Database["public"]["Enums"]["course_level"]
          media_approved_at: string | null
          media_approved_by: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          text_approved_at: string | null
          text_approved_by: string | null
          thumbnail: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          ai_generation_notes?: Json
          ai_media_status?: string
          ai_publish_status?: string
          ai_text_status?: string
          category: string
          created_at?: string
          description: string
          estimated_minutes?: number
          id: string
          level?: Database["public"]["Enums"]["course_level"]
          media_approved_at?: string | null
          media_approved_by?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          text_approved_at?: string | null
          text_approved_by?: string | null
          thumbnail?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          ai_generation_notes?: Json
          ai_media_status?: string
          ai_publish_status?: string
          ai_text_status?: string
          category?: string
          created_at?: string
          description?: string
          estimated_minutes?: number
          id?: string
          level?: Database["public"]["Enums"]["course_level"]
          media_approved_at?: string | null
          media_approved_by?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          text_approved_at?: string | null
          text_approved_by?: string | null
          thumbnail?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      learning_media_assets: {
        Row: {
          alt_text: string | null
          asset_type: string
          caption: string | null
          course_id: string | null
          created_at: string
          generation_error: string | null
          generation_status: string
          id: string
          lesson_id: string | null
          metadata: Json
          model: string | null
          placement: string
          prompt: string | null
          provider: string | null
          review_status: string
          script: string | null
          sort_order: number
          source: string
          storage_path: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          alt_text?: string | null
          asset_type: string
          caption?: string | null
          course_id?: string | null
          created_at?: string
          generation_error?: string | null
          generation_status?: string
          id?: string
          lesson_id?: string | null
          metadata?: Json
          model?: string | null
          placement: string
          prompt?: string | null
          provider?: string | null
          review_status?: string
          script?: string | null
          sort_order?: number
          source?: string
          storage_path?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          alt_text?: string | null
          asset_type?: string
          caption?: string | null
          course_id?: string | null
          created_at?: string
          generation_error?: string | null
          generation_status?: string
          id?: string
          lesson_id?: string | null
          metadata?: Json
          model?: string | null
          placement?: string
          prompt?: string | null
          provider?: string | null
          review_status?: string
          script?: string | null
          sort_order?: number
          source?: string
          storage_path?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_media_assets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_media_assets_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_content_blocks: {
        Row: {
          block_type: Database["public"]["Enums"]["lesson_content_block_type"]
          created_at: string
          id: string
          page_id: string
          payload: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          block_type: Database["public"]["Enums"]["lesson_content_block_type"]
          created_at?: string
          id?: string
          page_id: string
          payload?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          block_type?: Database["public"]["Enums"]["lesson_content_block_type"]
          created_at?: string
          id?: string
          page_id?: string
          payload?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_content_blocks_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "lesson_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_page_completions: {
        Row: {
          completed_at: string
          lesson_id: string
          page_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          lesson_id: string
          page_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          lesson_id?: string
          page_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_page_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_page_completions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "lesson_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_pages: {
        Row: {
          cover_image: Json | null
          created_at: string
          id: string
          lesson_id: string
          page_number: number
          page_type: Database["public"]["Enums"]["lesson_page_type"]
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_image?: Json | null
          created_at?: string
          id: string
          lesson_id: string
          page_number: number
          page_type?: Database["public"]["Enums"]["lesson_page_type"]
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_image?: Json | null
          created_at?: string
          id?: string
          lesson_id?: string
          page_number?: number
          page_type?: Database["public"]["Enums"]["lesson_page_type"]
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_pages_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          completed_modules: string[]
          completed_pages: string[]
          id: string
          lesson_id: string
          quiz_score: number | null
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_modules?: string[]
          completed_pages?: string[]
          id?: string
          lesson_id: string
          quiz_score?: number | null
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_modules?: string[]
          completed_pages?: string[]
          id?: string
          lesson_id?: string
          quiz_score?: number | null
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          ai_generated: boolean
          ai_generation_notes: Json
          ai_media_status: string
          ai_publish_status: string
          ai_text_status: string
          course_id: string
          cover_image: Json | null
          created_at: string
          description: string | null
          estimated_minutes: number
          id: string
          max_earning_attempts: number | null
          media_approved_at: string | null
          media_approved_by: string | null
          quiz_requires_lesson_completion: boolean
          retry_cooldown_seconds: number | null
          retry_mode: Database["public"]["Enums"]["lesson_retry_mode"]
          retry_requires_reread: boolean
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          subtitle: string | null
          text_approved_at: string | null
          text_approved_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          ai_generation_notes?: Json
          ai_media_status?: string
          ai_publish_status?: string
          ai_text_status?: string
          course_id: string
          cover_image?: Json | null
          created_at?: string
          description?: string | null
          estimated_minutes?: number
          id: string
          max_earning_attempts?: number | null
          media_approved_at?: string | null
          media_approved_by?: string | null
          quiz_requires_lesson_completion?: boolean
          retry_cooldown_seconds?: number | null
          retry_mode?: Database["public"]["Enums"]["lesson_retry_mode"]
          retry_requires_reread?: boolean
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          subtitle?: string | null
          text_approved_at?: string | null
          text_approved_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          ai_generation_notes?: Json
          ai_media_status?: string
          ai_publish_status?: string
          ai_text_status?: string
          course_id?: string
          cover_image?: Json | null
          created_at?: string
          description?: string | null
          estimated_minutes?: number
          id?: string
          max_earning_attempts?: number | null
          media_approved_at?: string | null
          media_approved_by?: string | null
          quiz_requires_lesson_completion?: boolean
          retry_cooldown_seconds?: number | null
          retry_mode?: Database["public"]["Enums"]["lesson_retry_mode"]
          retry_requires_reread?: boolean
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          subtitle?: string | null
          text_approved_at?: string | null
          text_approved_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_awards: {
        Row: {
          award_scope: string
          awarded_at: string
          id: string
          mission_id: string
          reward_redemption_id: string | null
          user_id: string
          xp_transaction_id: string | null
        }
        Insert: {
          award_scope: string
          awarded_at?: string
          id?: string
          mission_id: string
          reward_redemption_id?: string | null
          user_id: string
          xp_transaction_id?: string | null
        }
        Update: {
          award_scope?: string
          awarded_at?: string
          id?: string
          mission_id?: string
          reward_redemption_id?: string | null
          user_id?: string
          xp_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_awards_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_awards_reward_redemption_id_fkey"
            columns: ["reward_redemption_id"]
            isOneToOne: false
            referencedRelation: "reward_redemptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_awards_xp_transaction_id_fkey"
            columns: ["xp_transaction_id"]
            isOneToOne: true
            referencedRelation: "xp_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_proofs: {
        Row: {
          award_scope: string
          created_at: string
          id: string
          mission_id: string
          proof_type: Database["public"]["Enums"]["mission_proof_type"]
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          award_scope: string
          created_at?: string
          id?: string
          mission_id: string
          proof_type: Database["public"]["Enums"]["mission_proof_type"]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          award_scope?: string
          created_at?: string
          id?: string
          mission_id?: string
          proof_type?: Database["public"]["Enums"]["mission_proof_type"]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_proofs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          category: Database["public"]["Enums"]["mission_category"]
          created_at: string
          description: string
          ends_at: string | null
          id: string
          repeatability: Database["public"]["Enums"]["mission_repeatability"]
          reward_id: string | null
          reward_type: string
          reward_xp: number | null
          sort_order: number
          starts_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
          validation_config: Json
          validation_type: Database["public"]["Enums"]["mission_validation_type"]
        }
        Insert: {
          category: Database["public"]["Enums"]["mission_category"]
          created_at?: string
          description: string
          ends_at?: string | null
          id: string
          repeatability?: Database["public"]["Enums"]["mission_repeatability"]
          reward_id?: string | null
          reward_type?: string
          reward_xp?: number | null
          sort_order?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
          validation_config?: Json
          validation_type: Database["public"]["Enums"]["mission_validation_type"]
        }
        Update: {
          category?: Database["public"]["Enums"]["mission_category"]
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          repeatability?: Database["public"]["Enums"]["mission_repeatability"]
          reward_id?: string | null
          reward_type?: string
          reward_xp?: number | null
          sort_order?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
          validation_config?: Json
          validation_type?: Database["public"]["Enums"]["mission_validation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "missions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          account_enabled: boolean
          created_at: string
          in_app_enabled: boolean
          missions_enabled: boolean
          rewards_enabled: boolean
          system_enabled: boolean
          updated_at: string
          user_id: string
          web_push_enabled: boolean
        }
        Insert: {
          account_enabled?: boolean
          created_at?: string
          in_app_enabled?: boolean
          missions_enabled?: boolean
          rewards_enabled?: boolean
          system_enabled?: boolean
          updated_at?: string
          user_id: string
          web_push_enabled?: boolean
        }
        Update: {
          account_enabled?: boolean
          created_at?: string
          in_app_enabled?: boolean
          missions_enabled?: boolean
          rewards_enabled?: boolean
          system_enabled?: boolean
          updated_at?: string
          user_id?: string
          web_push_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      perk_bundle_draws: {
        Row: {
          award_status: string
          awarded_fulfillment_type: string
          awarded_inventory_item_id: string | null
          awarded_payload: Json
          awarded_quantity_allocation_id: string | null
          awarded_reward_id: string | null
          awarded_thumbnail: Json
          awarded_title: string
          bundle_quantity_allocation_id: string | null
          bundle_reward_id: string
          created_at: string
          id: string
          prize_id: string | null
          redemption_id: string
          user_id: string
        }
        Insert: {
          award_status?: string
          awarded_fulfillment_type: string
          awarded_inventory_item_id?: string | null
          awarded_payload?: Json
          awarded_quantity_allocation_id?: string | null
          awarded_reward_id?: string | null
          awarded_thumbnail?: Json
          awarded_title: string
          bundle_quantity_allocation_id?: string | null
          bundle_reward_id: string
          created_at?: string
          id?: string
          prize_id?: string | null
          redemption_id: string
          user_id: string
        }
        Update: {
          award_status?: string
          awarded_fulfillment_type?: string
          awarded_inventory_item_id?: string | null
          awarded_payload?: Json
          awarded_quantity_allocation_id?: string | null
          awarded_reward_id?: string | null
          awarded_thumbnail?: Json
          awarded_title?: string
          bundle_quantity_allocation_id?: string | null
          bundle_reward_id?: string
          created_at?: string
          id?: string
          prize_id?: string | null
          redemption_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perk_bundle_draws_awarded_inventory_item_id_fkey"
            columns: ["awarded_inventory_item_id"]
            isOneToOne: false
            referencedRelation: "reward_inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perk_bundle_draws_awarded_quantity_allocation_id_fkey"
            columns: ["awarded_quantity_allocation_id"]
            isOneToOne: false
            referencedRelation: "reward_quantity_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perk_bundle_draws_awarded_reward_id_fkey"
            columns: ["awarded_reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perk_bundle_draws_bundle_quantity_allocation_id_fkey"
            columns: ["bundle_quantity_allocation_id"]
            isOneToOne: false
            referencedRelation: "reward_quantity_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perk_bundle_draws_bundle_reward_id_fkey"
            columns: ["bundle_reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perk_bundle_draws_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "perk_bundle_prizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perk_bundle_draws_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: true
            referencedRelation: "reward_redemptions"
            referencedColumns: ["id"]
          },
        ]
      }
      perk_bundle_prizes: {
        Row: {
          available_from: string | null
          bundle_reward_id: string
          config: Json
          created_at: string
          daily_win_cap: number | null
          expires_at: string | null
          id: string
          is_enabled: boolean
          prize_type: string
          sort_order: number
          source_reward_id: string | null
          thumbnail: Json
          title: string | null
          total_win_cap: number | null
          updated_at: string
          weight: number
        }
        Insert: {
          available_from?: string | null
          bundle_reward_id: string
          config?: Json
          created_at?: string
          daily_win_cap?: number | null
          expires_at?: string | null
          id?: string
          is_enabled?: boolean
          prize_type: string
          sort_order?: number
          source_reward_id?: string | null
          thumbnail?: Json
          title?: string | null
          total_win_cap?: number | null
          updated_at?: string
          weight?: number
        }
        Update: {
          available_from?: string | null
          bundle_reward_id?: string
          config?: Json
          created_at?: string
          daily_win_cap?: number | null
          expires_at?: string | null
          id?: string
          is_enabled?: boolean
          prize_type?: string
          sort_order?: number
          source_reward_id?: string | null
          thumbnail?: Json
          title?: string | null
          total_win_cap?: number | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "perk_bundle_prizes_bundle_reward_id_fkey"
            columns: ["bundle_reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perk_bundle_prizes_source_reward_id_fkey"
            columns: ["source_reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      perk_prize_release_buckets: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_enabled: boolean
          label: string | null
          prize_id: string
          release_cap: number
          sort_order: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_enabled?: boolean
          label?: string | null
          prize_id: string
          release_cap: number
          sort_order?: number
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_enabled?: boolean
          label?: string | null
          prize_id?: string
          release_cap?: number
          sort_order?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perk_prize_release_buckets_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "perk_bundle_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          fraud_flags: Json
          fraud_review_status: string
          id: string
          redemption_unlocked_at: string | null
          referral_code: string | null
          role: string
          updated_at: string
          xp: number
          xp_balance_cached: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          fraud_flags?: Json
          fraud_review_status?: string
          id: string
          redemption_unlocked_at?: string | null
          referral_code?: string | null
          role?: string
          updated_at?: string
          xp?: number
          xp_balance_cached?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          fraud_flags?: Json
          fraud_review_status?: string
          id?: string
          redemption_unlocked_at?: string | null
          referral_code?: string | null
          role?: string
          updated_at?: string
          xp?: number
          xp_balance_cached?: number
        }
        Relationships: []
      }
      quiz_answers: {
        Row: {
          answered_at: string
          attempt_id: string
          earned_xp: number
          id: string
          is_correct: boolean
          question_id: string
          selected_option_ids: string[]
          status: Database["public"]["Enums"]["quiz_answer_status"]
          user_id: string
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          earned_xp?: number
          id?: string
          is_correct: boolean
          question_id: string
          selected_option_ids?: string[]
          status: Database["public"]["Enums"]["quiz_answer_status"]
          user_id: string
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          earned_xp?: number
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_option_ids?: string[]
          status?: Database["public"]["Enums"]["quiz_answer_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "learner_quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempt_questions: {
        Row: {
          attempt_id: string
          options_snapshot: Json
          question_id: string
          question_order: number
          question_snapshot: Json
          xp: number
        }
        Insert: {
          attempt_id: string
          options_snapshot: Json
          question_id: string
          question_order: number
          question_snapshot: Json
          xp: number
        }
        Update: {
          attempt_id?: string
          options_snapshot?: Json
          question_id?: string
          question_order?: number
          question_snapshot?: Json
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempt_questions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempt_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "learner_quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempt_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          created_at: string
          ended_at: string | null
          ended_reason: string | null
          id: string
          lesson_id: string
          mode: Database["public"]["Enums"]["quiz_attempt_mode"]
          quiz_id: string
          quiz_version: number
          seed: string
          started_at: string
          status: Database["public"]["Enums"]["quiz_attempt_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          lesson_id: string
          mode?: Database["public"]["Enums"]["quiz_attempt_mode"]
          quiz_id: string
          quiz_version: number
          seed: string
          started_at?: string
          status?: Database["public"]["Enums"]["quiz_attempt_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          lesson_id?: string
          mode?: Database["public"]["Enums"]["quiz_attempt_mode"]
          quiz_id?: string
          quiz_version?: number
          seed?: string
          started_at?: string
          status?: Database["public"]["Enums"]["quiz_attempt_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_options: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          label: string
          option_order: number
          question_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_correct?: boolean
          label: string
          option_order: number
          question_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          label?: string
          option_order?: number
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "learner_quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          prompt: string
          question_order: number
          question_type: Database["public"]["Enums"]["quiz_question_type"]
          quiz_id: string
          updated_at: string
          xp: number
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id: string
          prompt: string
          question_order: number
          question_type: Database["public"]["Enums"]["quiz_question_type"]
          quiz_id: string
          updated_at?: string
          xp: number
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          prompt?: string
          question_order?: number
          question_type?: Database["public"]["Enums"]["quiz_question_type"]
          quiz_id?: string
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          ai_generated: boolean
          ai_generation_notes: Json
          ai_text_status: string
          created_at: string
          id: string
          lesson_id: string
          status: Database["public"]["Enums"]["content_status"]
          text_approved_at: string | null
          text_approved_by: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          ai_generated?: boolean
          ai_generation_notes?: Json
          ai_text_status?: string
          created_at?: string
          id: string
          lesson_id: string
          status?: Database["public"]["Enums"]["content_status"]
          text_approved_at?: string | null
          text_approved_by?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          ai_generated?: boolean
          ai_generation_notes?: Json
          ai_text_status?: string
          created_at?: string
          id?: string
          lesson_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          text_approved_at?: string | null
          text_approved_by?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          section_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          section_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          section_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "recommendation_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_sections: {
        Row: {
          created_at: string
          ends_at: string | null
          eyebrow: string | null
          id: string
          placement: string
          slug: string
          sort_order: number
          starts_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          eyebrow?: string | null
          id: string
          placement?: string
          slug: string
          sort_order?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          eyebrow?: string | null
          id?: string
          placement?: string
          slug?: string
          sort_order?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_attributions: {
        Row: {
          created_at: string
          id: string
          qualified_at: string | null
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          qualified_at?: string | null
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          qualified_at?: string | null
          referral_code?: string
          referred_user_id?: string
          referrer_user_id?: string
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Relationships: []
      }
      referral_link_visits: {
        Row: {
          first_visited_at: string
          id: string
          last_visited_at: string
          referral_code: string
          referrer_user_id: string
          user_agent: string | null
          visit_count: number
          visitor_key: string
        }
        Insert: {
          first_visited_at?: string
          id?: string
          last_visited_at?: string
          referral_code: string
          referrer_user_id: string
          user_agent?: string | null
          visit_count?: number
          visitor_key: string
        }
        Update: {
          first_visited_at?: string
          id?: string
          last_visited_at?: string
          referral_code?: string
          referrer_user_id?: string
          user_agent?: string | null
          visit_count?: number
          visitor_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_link_visits_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_inventory_adjustments: {
        Row: {
          available_from: string | null
          batch_id: string | null
          batch_label: string | null
          campaign_id: string | null
          created_at: string
          created_by: string | null
          delta: number
          expires_at: string | null
          id: string
          partner_reference: string | null
          reason: string
          reward_id: string
        }
        Insert: {
          available_from?: string | null
          batch_id?: string | null
          batch_label?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          delta: number
          expires_at?: string | null
          id?: string
          partner_reference?: string | null
          reason: string
          reward_id: string
        }
        Update: {
          available_from?: string | null
          batch_id?: string | null
          batch_label?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          delta?: number
          expires_at?: string | null
          id?: string
          partner_reference?: string | null
          reason?: string
          reward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_inventory_adjustments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "reward_inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_inventory_adjustments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_inventory_adjustments_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_inventory_batches: {
        Row: {
          available_from: string | null
          batch_label: string | null
          campaign_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          duplicate_rows: number
          error_message: string | null
          expires_at: string | null
          id: string
          imported_rows: number
          invalid_rows: number
          item_type: string
          original_filename: string | null
          partner_reference: string | null
          reward_id: string
          source: string
          status: string
          total_rows: number
          updated_at: string
          valid_rows: number
        }
        Insert: {
          available_from?: string | null
          batch_label?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          error_message?: string | null
          expires_at?: string | null
          id?: string
          imported_rows?: number
          invalid_rows?: number
          item_type: string
          original_filename?: string | null
          partner_reference?: string | null
          reward_id: string
          source?: string
          status?: string
          total_rows?: number
          updated_at?: string
          valid_rows?: number
        }
        Update: {
          available_from?: string | null
          batch_label?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          error_message?: string | null
          expires_at?: string | null
          id?: string
          imported_rows?: number
          invalid_rows?: number
          item_type?: string
          original_filename?: string | null
          partner_reference?: string | null
          reward_id?: string
          source?: string
          status?: string
          total_rows?: number
          updated_at?: string
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "reward_inventory_batches_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_inventory_batches_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_inventory_items: {
        Row: {
          assigned_at: string | null
          available_from: string | null
          batch_id: string | null
          batch_label: string | null
          campaign_id: string | null
          expires_at: string | null
          id: string
          item_type: string
          notes: string | null
          partner_reference: string | null
          payload: Json
          perk_prize_id: string | null
          redeemed_at: string | null
          redemption_id: string | null
          reward_id: string
          status: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          assigned_at?: string | null
          available_from?: string | null
          batch_id?: string | null
          batch_label?: string | null
          campaign_id?: string | null
          expires_at?: string | null
          id?: string
          item_type: string
          notes?: string | null
          partner_reference?: string | null
          payload?: Json
          perk_prize_id?: string | null
          redeemed_at?: string | null
          redemption_id?: string | null
          reward_id: string
          status?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          assigned_at?: string | null
          available_from?: string | null
          batch_id?: string | null
          batch_label?: string | null
          campaign_id?: string | null
          expires_at?: string | null
          id?: string
          item_type?: string
          notes?: string | null
          partner_reference?: string | null
          payload?: Json
          perk_prize_id?: string | null
          redeemed_at?: string | null
          redemption_id?: string | null
          reward_id?: string
          status?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_inventory_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "reward_inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_inventory_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_inventory_items_perk_prize_id_fkey"
            columns: ["perk_prize_id"]
            isOneToOne: false
            referencedRelation: "perk_bundle_prizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_inventory_items_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: true
            referencedRelation: "reward_redemptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_inventory_items_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_inventory_reallocations: {
        Row: {
          available_from: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          from_campaign_id: string | null
          from_quantity_allocation_ids: Json
          id: string
          inventory_item_ids: Json
          inventory_type: string
          quantity: number
          reason: string
          reward_id: string
          to_campaign_id: string | null
          to_quantity_allocation_id: string | null
        }
        Insert: {
          available_from?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          from_campaign_id?: string | null
          from_quantity_allocation_ids?: Json
          id?: string
          inventory_item_ids?: Json
          inventory_type: string
          quantity: number
          reason: string
          reward_id: string
          to_campaign_id?: string | null
          to_quantity_allocation_id?: string | null
        }
        Update: {
          available_from?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          from_campaign_id?: string | null
          from_quantity_allocation_ids?: Json
          id?: string
          inventory_item_ids?: Json
          inventory_type?: string
          quantity?: number
          reason?: string
          reward_id?: string
          to_campaign_id?: string | null
          to_quantity_allocation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_inventory_reallocations_from_campaign_id_fkey"
            columns: ["from_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_inventory_reallocations_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_inventory_reallocations_to_campaign_id_fkey"
            columns: ["to_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_inventory_reallocations_to_quantity_allocation_id_fkey"
            columns: ["to_quantity_allocation_id"]
            isOneToOne: false
            referencedRelation: "reward_quantity_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_quantity_allocations: {
        Row: {
          allocation_type: string
          available_from: string | null
          batch_id: string | null
          batch_label: string | null
          campaign_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          partner_reference: string | null
          perk_prize_id: string | null
          quantity_available: number
          quantity_total: number
          reason: string | null
          reward_id: string
          source_allocation_id: string | null
          updated_at: string
        }
        Insert: {
          allocation_type?: string
          available_from?: string | null
          batch_id?: string | null
          batch_label?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          partner_reference?: string | null
          perk_prize_id?: string | null
          quantity_available: number
          quantity_total: number
          reason?: string | null
          reward_id: string
          source_allocation_id?: string | null
          updated_at?: string
        }
        Update: {
          allocation_type?: string
          available_from?: string | null
          batch_id?: string | null
          batch_label?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          partner_reference?: string | null
          perk_prize_id?: string | null
          quantity_available?: number
          quantity_total?: number
          reason?: string | null
          reward_id?: string
          source_allocation_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_quantity_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "reward_inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_quantity_allocations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_quantity_allocations_perk_prize_id_fkey"
            columns: ["perk_prize_id"]
            isOneToOne: false
            referencedRelation: "perk_bundle_prizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_quantity_allocations_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_quantity_allocations_source_allocation_id_fkey"
            columns: ["source_allocation_id"]
            isOneToOne: false
            referencedRelation: "reward_quantity_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          admin_note: string | null
          awarded_reward_id: string | null
          bundle_reward_id: string | null
          claim_data: Json | null
          claim_started_at: string | null
          claim_state: string
          claim_steps_snapshot: Json
          claim_submitted_at: string | null
          expired_at: string | null
          expiry_reason: string | null
          fulfilled_at: string | null
          fulfillment_config_snapshot: Json
          fulfillment_payload: Json
          fulfillment_type: string | null
          id: string
          inventory_item_id: string | null
          notes: string | null
          quantity_allocation_id: string | null
          redemption_expires_at: string | null
          refund_xp_transaction_id: string | null
          refunded_at: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          reward_description_snapshot: string | null
          reward_id: string
          reward_thumbnail_snapshot: Json
          reward_title_snapshot: string | null
          status: Database["public"]["Enums"]["redemption_status"]
          user_id: string
          user_message: string | null
          xp_cost_at_redemption: number | null
          xp_transaction_id: string | null
        }
        Insert: {
          admin_note?: string | null
          awarded_reward_id?: string | null
          bundle_reward_id?: string | null
          claim_data?: Json | null
          claim_started_at?: string | null
          claim_state?: string
          claim_steps_snapshot?: Json
          claim_submitted_at?: string | null
          expired_at?: string | null
          expiry_reason?: string | null
          fulfilled_at?: string | null
          fulfillment_config_snapshot?: Json
          fulfillment_payload?: Json
          fulfillment_type?: string | null
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          quantity_allocation_id?: string | null
          redemption_expires_at?: string | null
          refund_xp_transaction_id?: string | null
          refunded_at?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward_description_snapshot?: string | null
          reward_id: string
          reward_thumbnail_snapshot?: Json
          reward_title_snapshot?: string | null
          status?: Database["public"]["Enums"]["redemption_status"]
          user_id: string
          user_message?: string | null
          xp_cost_at_redemption?: number | null
          xp_transaction_id?: string | null
        }
        Update: {
          admin_note?: string | null
          awarded_reward_id?: string | null
          bundle_reward_id?: string | null
          claim_data?: Json | null
          claim_started_at?: string | null
          claim_state?: string
          claim_steps_snapshot?: Json
          claim_submitted_at?: string | null
          expired_at?: string | null
          expiry_reason?: string | null
          fulfilled_at?: string | null
          fulfillment_config_snapshot?: Json
          fulfillment_payload?: Json
          fulfillment_type?: string | null
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          quantity_allocation_id?: string | null
          redemption_expires_at?: string | null
          refund_xp_transaction_id?: string | null
          refunded_at?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward_description_snapshot?: string | null
          reward_id?: string
          reward_thumbnail_snapshot?: Json
          reward_title_snapshot?: string | null
          status?: Database["public"]["Enums"]["redemption_status"]
          user_id?: string
          user_message?: string | null
          xp_cost_at_redemption?: number | null
          xp_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_awarded_reward_id_fkey"
            columns: ["awarded_reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_bundle_reward_id_fkey"
            columns: ["bundle_reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "reward_inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_quantity_allocation_id_fkey"
            columns: ["quantity_allocation_id"]
            isOneToOne: false
            referencedRelation: "reward_quantity_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_refund_xp_transaction_id_fkey"
            columns: ["refund_xp_transaction_id"]
            isOneToOne: true
            referencedRelation: "xp_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_xp_transaction_id_fkey"
            columns: ["xp_transaction_id"]
            isOneToOne: true
            referencedRelation: "xp_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          campaign_id: string | null
          claim_steps: Json
          cost_xp: number
          created_at: string
          description: string | null
          distribution_mode: string
          ends_at: string | null
          fulfillment_config: Json
          fulfillment_type: string
          id: string
          inventory_count: number | null
          is_enabled: boolean
          limit_period: string
          offer_expires_at: string | null
          per_user_limit: number
          redemption_window_days: number | null
          sort_order: number
          starts_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          terms: string | null
          thumbnail: Json
          title: string
          total_available: number
          total_uploaded: number
          updated_at: string
          visibility_mode: string
        }
        Insert: {
          campaign_id?: string | null
          claim_steps?: Json
          cost_xp: number
          created_at?: string
          description?: string | null
          distribution_mode?: string
          ends_at?: string | null
          fulfillment_config?: Json
          fulfillment_type?: string
          id: string
          inventory_count?: number | null
          is_enabled?: boolean
          limit_period?: string
          offer_expires_at?: string | null
          per_user_limit?: number
          redemption_window_days?: number | null
          sort_order?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          terms?: string | null
          thumbnail?: Json
          title: string
          total_available?: number
          total_uploaded?: number
          updated_at?: string
          visibility_mode?: string
        }
        Update: {
          campaign_id?: string | null
          claim_steps?: Json
          cost_xp?: number
          created_at?: string
          description?: string | null
          distribution_mode?: string
          ends_at?: string | null
          fulfillment_config?: Json
          fulfillment_type?: string
          id?: string
          inventory_count?: number | null
          is_enabled?: boolean
          limit_period?: string
          offer_expires_at?: string | null
          per_user_limit?: number
          redemption_window_days?: number | null
          sort_order?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          terms?: string | null
          thumbnail?: Json
          title?: string
          total_available?: number
          total_uploaded?: number
          updated_at?: string
          visibility_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_attempts: {
        Row: {
          block_reason: string | null
          blocked: boolean
          captcha_passed: boolean
          created_at: string
          device_hash: string | null
          email_domain: string
          id: string
          ip_hash: string | null
        }
        Insert: {
          block_reason?: string | null
          blocked?: boolean
          captcha_passed?: boolean
          created_at?: string
          device_hash?: string | null
          email_domain: string
          id?: string
          ip_hash?: string | null
        }
        Update: {
          block_reason?: string | null
          blocked?: boolean
          captcha_passed?: boolean
          created_at?: string
          device_hash?: string | null
          email_domain?: string
          id?: string
          ip_hash?: string | null
        }
        Relationships: []
      }
      static_content_pages: {
        Row: {
          body: string
          created_at: string
          faq_items: Json
          is_published: boolean
          slug: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          faq_items?: Json
          is_published?: boolean
          slug: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          faq_items?: Json
          is_published?: boolean
          slug?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_assessment_answers: {
        Row: {
          attempt_id: string
          option_id: string
          question_id: string
        }
        Insert: {
          attempt_id: string
          option_id: string
          question_id: string
        }
        Update: {
          attempt_id?: string
          option_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_assessment_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "user_assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assessment_answers_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "assessment_question_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assessment_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_assessment_attempts: {
        Row: {
          assessment_version_id: string
          completed_at: string | null
          id: string
          started_at: string
          status: string
          user_id: string
          xp_transaction_id: string | null
        }
        Insert: {
          assessment_version_id: string
          completed_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id: string
          xp_transaction_id?: string | null
        }
        Update: {
          assessment_version_id?: string
          completed_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id?: string
          xp_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_assessment_attempts_assessment_version_id_fkey"
            columns: ["assessment_version_id"]
            isOneToOne: false
            referencedRelation: "assessment_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assessment_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assessment_attempts_xp_transaction_id_fkey"
            columns: ["xp_transaction_id"]
            isOneToOne: false
            referencedRelation: "xp_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_xp_limits: {
        Row: {
          created_at: string
          earnable_quiz_xp_limit: number
          local_date: string
          timezone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          earnable_quiz_xp_limit?: number
          local_date: string
          timezone?: string
          user_id: string
        }
        Update: {
          created_at?: string
          earnable_quiz_xp_limit?: number
          local_date?: string
          timezone?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string
          category: string
          created_at: string
          cta_href: string | null
          cta_label: string | null
          data: Json
          dedupe_key: string
          event_type: string
          id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          data?: Json
          dedupe_key: string
          event_type: string
          id?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          data?: Json
          dedupe_key?: string
          event_type?: string
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_push_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          failed_at: string | null
          id: string
          last_attempted_at: string | null
          last_error: string | null
          notification_id: string
          response_code: number | null
          sent_at: string | null
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          failed_at?: string | null
          id?: string
          last_attempted_at?: string | null
          last_error?: string | null
          notification_id: string
          response_code?: number | null
          sent_at?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          failed_at?: string | null
          id?: string
          last_attempted_at?: string | null
          last_error?: string | null
          notification_id?: string
          response_code?: number | null
          sent_at?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_push_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "user_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_push_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_push_subscriptions: {
        Row: {
          created_at: string
          device_key: string
          disabled_at: string | null
          endpoint: string
          failure_count: number
          id: string
          last_error: string | null
          last_seen_at: string
          subscription: Json
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_key: string
          disabled_at?: string | null
          endpoint: string
          failure_count?: number
          id?: string
          last_error?: string | null
          last_seen_at?: string
          subscription: Json
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_key?: string
          disabled_at?: string | null
          endpoint?: string
          failure_count?: number
          id?: string
          last_error?: string | null
          last_seen_at?: string
          subscription?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_risk_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          severity: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          severity?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          severity?: number
          user_id?: string | null
        }
        Relationships: []
      }
      user_value_dimension_scores: {
        Row: {
          confidence: number
          dimension_id: string
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          dimension_id: string
          score: number
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          dimension_id?: string
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_value_dimension_scores_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "value_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_value_dimension_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_value_profiles: {
        Row: {
          assessment_completed_at: string | null
          assessment_version_id: string | null
          latest_attempt_id: string | null
          primary_dimension_id: string | null
          profile_summary: Json
          readiness_level: string
          secondary_dimension_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_completed_at?: string | null
          assessment_version_id?: string | null
          latest_attempt_id?: string | null
          primary_dimension_id?: string | null
          profile_summary?: Json
          readiness_level?: string
          secondary_dimension_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_completed_at?: string | null
          assessment_version_id?: string | null
          latest_attempt_id?: string | null
          primary_dimension_id?: string | null
          profile_summary?: Json
          readiness_level?: string
          secondary_dimension_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_value_profiles_assessment_version_id_fkey"
            columns: ["assessment_version_id"]
            isOneToOne: false
            referencedRelation: "assessment_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_value_profiles_latest_attempt_id_fkey"
            columns: ["latest_attempt_id"]
            isOneToOne: false
            referencedRelation: "user_assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_value_profiles_primary_dimension_id_fkey"
            columns: ["primary_dimension_id"]
            isOneToOne: false
            referencedRelation: "value_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_value_profiles_secondary_dimension_id_fkey"
            columns: ["secondary_dimension_id"]
            isOneToOne: false
            referencedRelation: "value_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_value_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_xp_boosts: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          multiplier: number
          redemption_id: string
          remaining_uses: number | null
          starts_at: string
          status: string
          used_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          multiplier: number
          redemption_id: string
          remaining_uses?: number | null
          starts_at?: string
          status?: string
          used_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          multiplier?: number
          redemption_id?: string
          remaining_uses?: number | null
          starts_at?: string
          status?: string
          used_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_xp_boosts_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: true
            referencedRelation: "reward_redemptions"
            referencedColumns: ["id"]
          },
        ]
      }
      value_dimensions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          label: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      xp_settings: {
        Row: {
          admin_manual_grant_daily_limit: number
          created_at: string
          default_daily_quiz_xp_limit: number
          id: number
          updated_at: string
        }
        Insert: {
          admin_manual_grant_daily_limit?: number
          created_at?: string
          default_daily_quiz_xp_limit?: number
          id?: number
          updated_at?: string
        }
        Update: {
          admin_manual_grant_daily_limit?: number
          created_at?: string
          default_daily_quiz_xp_limit?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      xp_transactions: {
        Row: {
          amount: number
          award_scope: string | null
          created_at: string
          direction: Database["public"]["Enums"]["xp_direction"]
          id: string
          metadata: Json
          source_id: string
          source_type: Database["public"]["Enums"]["xp_source_type"]
          user_id: string
        }
        Insert: {
          amount: number
          award_scope?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["xp_direction"]
          id?: string
          metadata?: Json
          source_id: string
          source_type: Database["public"]["Enums"]["xp_source_type"]
          user_id: string
        }
        Update: {
          amount?: number
          award_scope?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["xp_direction"]
          id?: string
          metadata?: Json
          source_id?: string
          source_type?: Database["public"]["Enums"]["xp_source_type"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      learner_quiz_options: {
        Row: {
          id: string | null
          label: string | null
          option_order: number | null
          question_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "learner_quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_quiz_questions: {
        Row: {
          id: string | null
          prompt: string | null
          question_order: number | null
          question_type:
            | Database["public"]["Enums"]["quiz_question_type"]
            | null
          quiz_id: string | null
          xp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_referral: { Args: { p_referral_code: string }; Returns: Json }
      admin_add_recommendation_item: {
        Args: {
          p_item_id: string
          p_item_type: string
          p_section_id: string
          p_sort_order: number
        }
        Returns: Json
      }
      admin_adjust_reward_quantity: {
        Args: { p_delta: number; p_reason: string; p_reward_id: string }
        Returns: Json
      }
      admin_assert_valid_mission_config: {
        Args: {
          p_validation_config: Json
          p_validation_type: Database["public"]["Enums"]["mission_validation_type"]
        }
        Returns: undefined
      }
      admin_assert_valid_mission_reward: {
        Args: {
          p_reward_id: string
          p_reward_type: string
          p_reward_xp: number
        }
        Returns: undefined
      }
      admin_assign_reward_stock_to_perk_prize: {
        Args: {
          p_available_from?: string
          p_expires_at?: string
          p_prize_id: string
          p_quantity: number
          p_reason?: string
        }
        Returns: Json
      }
      admin_audit_ad_event: {
        Args: {
          p_after_state: Json
          p_before_state: Json
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_reason: string
        }
        Returns: undefined
      }
      admin_complete_reward_inventory_batch: {
        Args: {
          p_batch_id: string
          p_error_message?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_create_mission:
        | {
            Args: {
              p_category: Database["public"]["Enums"]["mission_category"]
              p_description: string
              p_ends_at?: string
              p_mission_id: string
              p_repeatability: Database["public"]["Enums"]["mission_repeatability"]
              p_reward_id: string
              p_reward_type: string
              p_reward_xp: number
              p_sort_order?: number
              p_starts_at?: string
              p_status?: Database["public"]["Enums"]["content_status"]
              p_title: string
              p_validation_config?: Json
              p_validation_type: Database["public"]["Enums"]["mission_validation_type"]
            }
            Returns: Json
          }
        | {
            Args: {
              p_category: Database["public"]["Enums"]["mission_category"]
              p_description: string
              p_ends_at?: string
              p_mission_id: string
              p_repeatability: Database["public"]["Enums"]["mission_repeatability"]
              p_reward_xp: number
              p_sort_order?: number
              p_starts_at?: string
              p_status?: Database["public"]["Enums"]["content_status"]
              p_title: string
              p_validation_config?: Json
              p_validation_type: Database["public"]["Enums"]["mission_validation_type"]
            }
            Returns: Json
          }
      admin_create_reward:
        | {
            Args: {
              p_campaign_id?: string
              p_claim_steps: Json
              p_cost_xp: number
              p_description: string
              p_distribution_mode: string
              p_fulfillment_config: Json
              p_fulfillment_type: string
              p_is_enabled: boolean
              p_limit_period: string
              p_offer_expires_at: string
              p_per_user_limit: number
              p_redemption_window_days: number
              p_reward_id: string
              p_sort_order: number
              p_status: Database["public"]["Enums"]["content_status"]
              p_terms: string
              p_thumbnail: Json
              p_title: string
              p_total_available: number
              p_visibility_mode: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_claim_steps: Json
              p_cost_xp: number
              p_description: string
              p_fulfillment_config: Json
              p_fulfillment_type: string
              p_is_enabled: boolean
              p_limit_period: string
              p_offer_expires_at: string
              p_per_user_limit: number
              p_redemption_window_days: number
              p_reward_id: string
              p_sort_order: number
              p_status: Database["public"]["Enums"]["content_status"]
              p_terms: string
              p_thumbnail: Json
              p_title: string
              p_total_available: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_campaign_id?: string
              p_claim_steps: Json
              p_cost_xp: number
              p_description: string
              p_fulfillment_config: Json
              p_fulfillment_type: string
              p_is_enabled: boolean
              p_limit_period: string
              p_offer_expires_at: string
              p_per_user_limit: number
              p_redemption_window_days: number
              p_reward_id: string
              p_sort_order: number
              p_status: Database["public"]["Enums"]["content_status"]
              p_terms: string
              p_thumbnail: Json
              p_title: string
              p_total_available: number
            }
            Returns: Json
          }
      admin_create_reward_inventory_batch: {
        Args: {
          p_available_from: string
          p_batch_label: string
          p_campaign_id: string
          p_duplicate_rows: number
          p_expires_at: string
          p_invalid_rows: number
          p_original_filename: string
          p_partner_reference: string
          p_reward_id: string
          p_source: string
          p_total_rows: number
          p_valid_rows: number
        }
        Returns: Json
      }
      admin_delete_lesson_block: {
        Args: { p_block_id: string; p_page_id: string }
        Returns: Json
      }
      admin_delete_perk_bundle_prize: {
        Args: { p_prize_id: string }
        Returns: Json
      }
      admin_delete_perk_prize_release_bucket: {
        Args: { p_bucket_id: string }
        Returns: undefined
      }
      admin_delete_recommendation_item: {
        Args: { p_item_id: string }
        Returns: Json
      }
      admin_grant_user_xp: {
        Args: { p_amount: number; p_reason?: string; p_target_user_id: string }
        Returns: string
      }
      admin_insert_ad_creative_version: {
        Args: { p_payload: Json }
        Returns: Json
      }
      admin_insert_ad_flight: { Args: { p_payload: Json }; Returns: Json }
      admin_manual_xp_grant_status: {
        Args: never
        Returns: {
          daily_limit: number
          granted_today: number
          local_date: string
          remaining_today: number
        }[]
      }
      admin_mark_reward_redemption_fulfilled: {
        Args: { p_note?: string; p_redemption_id: string }
        Returns: Json
      }
      admin_perk_prize_assignment_counts: {
        Args: { p_prize_ids?: string[] }
        Returns: {
          assigned_available: number
          prize_id: string
        }[]
      }
      admin_reallocate_reward_inventory: {
        Args: {
          p_available_from?: string
          p_expires_at?: string
          p_from_campaign_id: string
          p_quantity: number
          p_reason?: string
          p_reward_id: string
          p_to_campaign_id: string
        }
        Returns: Json
      }
      admin_register_ad_creative_asset: {
        Args: { p_payload: Json }
        Returns: Json
      }
      admin_release_reward_stock_from_perk_prize: {
        Args: { p_prize_id: string; p_quantity: number; p_reason?: string }
        Returns: Json
      }
      admin_reorder_lesson_block: {
        Args: { p_block_id: string; p_direction: string; p_page_id: string }
        Returns: Json
      }
      admin_reorder_lesson_page: {
        Args: { p_direction: string; p_lesson_id: string; p_page_id: string }
        Returns: Json
      }
      admin_reset_ai_course_media: {
        Args: {
          p_course_id: string
          p_lesson_id?: string
          p_media_status?: string
        }
        Returns: undefined
      }
      admin_reset_ai_course_tree: {
        Args: { p_course_id: string; p_text_status?: string }
        Returns: undefined
      }
      admin_review_mission_proof_submission: {
        Args: {
          p_award_scope: string
          p_mission_id: string
          p_rejection_reason?: string
          p_status: Database["public"]["Enums"]["review_status"]
          p_user_id: string
        }
        Returns: Json
      }
      admin_reward_assignment_counts: {
        Args: { p_reward_ids?: string[] }
        Returns: {
          assigned_available: number
          direct_available: number
          reward_id: string
          total_available: number
        }[]
      }
      admin_set_ad_entity_status: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["ad_entity_status"]
        }
        Returns: Json
      }
      admin_set_campaign_enabled: {
        Args: { p_campaign_id: string; p_is_enabled: boolean }
        Returns: Json
      }
      admin_set_course_status: {
        Args: {
          p_course_id: string
          p_status: Database["public"]["Enums"]["content_status"]
        }
        Returns: Json
      }
      admin_set_lesson_status: {
        Args: {
          p_lesson_id: string
          p_status: Database["public"]["Enums"]["content_status"]
        }
        Returns: Json
      }
      admin_set_mission_status: {
        Args: {
          p_mission_id: string
          p_status: Database["public"]["Enums"]["content_status"]
        }
        Returns: Json
      }
      admin_set_recommendation_section_status: {
        Args: {
          p_section_id: string
          p_status: Database["public"]["Enums"]["content_status"]
        }
        Returns: Json
      }
      admin_set_reward_enabled: {
        Args: { p_is_enabled: boolean; p_reward_id: string }
        Returns: Json
      }
      admin_set_reward_quantity: {
        Args: {
          p_available_from?: string
          p_batch_label?: string
          p_campaign_id?: string
          p_expires_at?: string
          p_partner_reference?: string
          p_reason: string
          p_reward_id: string
          p_total_available: number
        }
        Returns: Json
      }
      admin_slugify: { Args: { p_value: string }; Returns: string }
      admin_sync_course_estimated_minutes: {
        Args: { p_course_id: string }
        Returns: Json
      }
      admin_update_ad_placement_fallback: {
        Args: {
          p_body: string
          p_cta_label: string
          p_cta_url: string
          p_enabled: boolean
          p_eyebrow: string
          p_headline: string
          p_placement_key: string
        }
        Returns: Json
      }
      admin_update_mission:
        | {
            Args: {
              p_category: Database["public"]["Enums"]["mission_category"]
              p_description: string
              p_ends_at?: string
              p_mission_id: string
              p_repeatability: Database["public"]["Enums"]["mission_repeatability"]
              p_reward_id: string
              p_reward_type: string
              p_reward_xp: number
              p_sort_order?: number
              p_starts_at?: string
              p_status?: Database["public"]["Enums"]["content_status"]
              p_title: string
              p_validation_config?: Json
              p_validation_type: Database["public"]["Enums"]["mission_validation_type"]
            }
            Returns: Json
          }
        | {
            Args: {
              p_category: Database["public"]["Enums"]["mission_category"]
              p_description: string
              p_ends_at?: string
              p_mission_id: string
              p_repeatability: Database["public"]["Enums"]["mission_repeatability"]
              p_reward_xp: number
              p_sort_order?: number
              p_starts_at?: string
              p_status?: Database["public"]["Enums"]["content_status"]
              p_title: string
              p_validation_config?: Json
              p_validation_type: Database["public"]["Enums"]["mission_validation_type"]
            }
            Returns: Json
          }
      admin_update_quiz: {
        Args: {
          p_quiz_id: string
          p_status: Database["public"]["Enums"]["content_status"]
          p_title: string
        }
        Returns: Json
      }
      admin_update_reward:
        | {
            Args: {
              p_campaign_id?: string
              p_claim_steps: Json
              p_cost_xp: number
              p_description: string
              p_distribution_mode: string
              p_fulfillment_config: Json
              p_fulfillment_type: string
              p_is_enabled: boolean
              p_limit_period: string
              p_offer_expires_at: string
              p_per_user_limit: number
              p_redemption_window_days: number
              p_reward_id: string
              p_sort_order: number
              p_status: Database["public"]["Enums"]["content_status"]
              p_terms: string
              p_thumbnail: Json
              p_title: string
              p_visibility_mode: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_claim_steps: Json
              p_cost_xp: number
              p_description: string
              p_fulfillment_config: Json
              p_fulfillment_type: string
              p_is_enabled: boolean
              p_limit_period: string
              p_offer_expires_at: string
              p_per_user_limit: number
              p_redemption_window_days: number
              p_reward_id: string
              p_sort_order: number
              p_status: Database["public"]["Enums"]["content_status"]
              p_terms: string
              p_thumbnail: Json
              p_title: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_campaign_id?: string
              p_claim_steps: Json
              p_cost_xp: number
              p_description: string
              p_fulfillment_config: Json
              p_fulfillment_type: string
              p_is_enabled: boolean
              p_limit_period: string
              p_offer_expires_at: string
              p_per_user_limit: number
              p_redemption_window_days: number
              p_reward_id: string
              p_sort_order: number
              p_status: Database["public"]["Enums"]["content_status"]
              p_terms: string
              p_thumbnail: Json
              p_title: string
            }
            Returns: Json
          }
      admin_upload_reward_inventory: {
        Args: {
          p_available_from?: string
          p_batch_id?: string
          p_batch_label?: string
          p_campaign_id?: string
          p_expires_at: string
          p_item_type: string
          p_items: Json
          p_partner_reference?: string
          p_reward_id: string
        }
        Returns: Json
      }
      admin_upsert_ad_campaign: { Args: { p_payload: Json }; Returns: Json }
      admin_upsert_ad_creative: { Args: { p_payload: Json }; Returns: Json }
      admin_upsert_ad_partner: { Args: { p_payload: Json }; Returns: Json }
      admin_upsert_campaign: {
        Args: {
          p_budget_label: string
          p_campaign_id: string
          p_description: string
          p_ends_at: string
          p_name: string
          p_starts_at: string
        }
        Returns: Json
      }
      admin_upsert_course: {
        Args: {
          p_category: string
          p_course_id: string
          p_description: string
          p_estimated_minutes: number
          p_level: Database["public"]["Enums"]["course_level"]
          p_sort_order: number
          p_status: Database["public"]["Enums"]["content_status"]
          p_thumbnail: Json
          p_title: string
        }
        Returns: Json
      }
      admin_upsert_lesson: {
        Args: {
          p_course_id: string
          p_cover_image: Json
          p_description: string
          p_estimated_minutes: number
          p_lesson_id: string
          p_max_earning_attempts: number
          p_quiz_requires_lesson_completion: boolean
          p_retry_cooldown_seconds: number
          p_retry_mode: Database["public"]["Enums"]["lesson_retry_mode"]
          p_retry_requires_reread: boolean
          p_sort_order: number
          p_status: Database["public"]["Enums"]["content_status"]
          p_title: string
        }
        Returns: Json
      }
      admin_upsert_lesson_block: {
        Args: {
          p_block_id: string
          p_block_type: Database["public"]["Enums"]["lesson_content_block_type"]
          p_page_id: string
          p_payload: Json
          p_sort_order: number
        }
        Returns: Json
      }
      admin_upsert_lesson_page: {
        Args: {
          p_cover_image: Json
          p_lesson_id: string
          p_page_id: string
          p_page_number: number
          p_page_type: Database["public"]["Enums"]["lesson_page_type"]
          p_subtitle: string
          p_title: string
        }
        Returns: Json
      }
      admin_upsert_perk_bundle_prize: {
        Args: {
          p_available_from?: string
          p_bundle_reward_id?: string
          p_config?: Json
          p_daily_win_cap?: number
          p_expires_at?: string
          p_is_enabled?: boolean
          p_prize_id?: string
          p_prize_type?: string
          p_sort_order?: number
          p_source_reward_id?: string
          p_thumbnail?: Json
          p_title?: string
          p_total_win_cap?: number
          p_weight?: number
        }
        Returns: Json
      }
      admin_upsert_perk_prize_release_bucket: {
        Args: {
          p_bucket_id?: string
          p_ends_at?: string
          p_is_enabled?: boolean
          p_label?: string
          p_prize_id?: string
          p_release_cap?: number
          p_sort_order?: number
          p_starts_at?: string
        }
        Returns: Json
      }
      admin_upsert_quiz_question: {
        Args: {
          p_explanation: string
          p_options: Json
          p_prompt: string
          p_question_id: string
          p_question_order: number
          p_question_type: Database["public"]["Enums"]["quiz_question_type"]
          p_quiz_id: string
          p_xp: number
        }
        Returns: Json
      }
      admin_upsert_recommendation_section: {
        Args: {
          p_ends_at: string
          p_eyebrow: string
          p_section_id: string
          p_sort_order: number
          p_starts_at: string
          p_status: Database["public"]["Enums"]["content_status"]
          p_subtitle: string
          p_title: string
        }
        Returns: Json
      }
      aggregate_ad_events_daily: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      answer_quiz_question: {
        Args: {
          p_attempt_id: string
          p_question_id: string
          p_selected_option_ids: string[]
        }
        Returns: Json
      }
      apply_native_reward_effect: {
        Args: {
          p_config: Json
          p_redemption_id: string
          p_source_reward_id: string
          p_user_id: string
        }
        Returns: Json
      }
      award_valid_mission_xp: {
        Args: { p_award_scope: string; p_mission_id: string }
        Returns: Json
      }
      campaign_is_live: { Args: { p_campaign_id: string }; Returns: boolean }
      complete_lesson_page: {
        Args: { p_lesson_id: string; p_page_id: string }
        Returns: Json
      }
      complete_values_assessment: {
        Args: { p_answers: Json; p_assessment_version_id: string }
        Returns: Json
      }
      create_ad_make_good_recommendations: { Args: never; Returns: Json }
      current_user_is_admin: { Args: never; Returns: boolean }
      email_domain: { Args: { email: string }; Returns: string }
      finalize_oauth_signup: {
        Args: {
          p_captcha_passed?: boolean
          p_device_hash: string
          p_ip_hash: string
        }
        Returns: Json
      }
      find_existing_reward_inventory_values: {
        Args: { p_item_type: string; p_reward_id: string; p_values: Json }
        Returns: {
          value: string
        }[]
      }
      generate_continue_learning_reminders: { Args: never; Returns: number }
      generate_referral_code: { Args: { user_id: string }; Returns: string }
      get_ad_click_target: { Args: { p_decision_id: string }; Returns: Json }
      get_ad_recent_lesson_decision: {
        Args: { p_placement_key: string; p_session_key_hash: string }
        Returns: Json
      }
      get_ad_runtime_counts: {
        Args: {
          p_campaign_id: string
          p_creative_version_id: string
          p_partner_id: string
          p_placement_key: string
          p_session_key_hash: string
        }
        Returns: Json
      }
      get_ad_session_competitor_keys: {
        Args: { p_session_key_hash: string }
        Returns: string[]
      }
      grant_mission_award: {
        Args: {
          p_award_scope: string
          p_metadata?: Json
          p_mission_id: string
          p_user_id: string
        }
        Returns: Json
      }
      increment_profile_xp: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      is_blocked_email_domain: { Args: { email: string }; Returns: boolean }
      lesson_is_complete_for_user: {
        Args: { p_lesson_id: string; p_user_id: string }
        Returns: boolean
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      mission_proof_fields_satisfy: {
        Args: {
          p_allowed_statuses: string[]
          p_award_scope: string
          p_mission_id: string
          p_required_fields: string[]
          p_requirement_mode: string
          p_user_id: string
        }
        Returns: boolean
      }
      notification_event_supports_push: {
        Args: { p_event_type: string }
        Returns: boolean
      }
      perk_prize_release_bucket_allows: {
        Args: { p_now?: string; p_prize_id: string }
        Returns: boolean
      }
      purge_old_ad_runtime_data: { Args: never; Returns: Json }
      queue_broadcast_notification: {
        Args: {
          p_body: string
          p_category: string
          p_cta_href?: string
          p_cta_label?: string
          p_data?: Json
          p_dedupe_key_prefix?: string
          p_event_type: string
          p_title: string
        }
        Returns: number
      }
      queue_push_deliveries_for_notification: {
        Args: { p_notification_id: string }
        Returns: number
      }
      queue_user_notification: {
        Args: {
          p_body: string
          p_category: string
          p_cta_href?: string
          p_cta_label?: string
          p_data?: Json
          p_dedupe_key?: string
          p_event_type: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      record_ad_decision: {
        Args: {
          p_campaign_id: string
          p_creative_id: string
          p_creative_version_id: string
          p_decision_context: Json
          p_eligible_flight_count: number
          p_experiment_key?: string
          p_flight_id: string
          p_ineligible_reasons: Json
          p_partner_id: string
          p_placement_key: string
          p_score_breakdown: Json
          p_session_key_hash: string
          p_user_id: string
          p_variant_key?: string
        }
        Returns: Json
      }
      record_ad_event: {
        Args: {
          p_client_event_time: string
          p_decision_id: string
          p_device_hash: string
          p_event_dedupe_key: string
          p_event_type: Database["public"]["Enums"]["ad_event_type"]
          p_ip_hash: string
          p_metadata?: Json
          p_user_agent_hash: string
        }
        Returns: Json
      }
      record_ad_house_fallback_event: {
        Args: {
          p_client_event_time: string
          p_device_hash: string
          p_event_dedupe_key: string
          p_event_type: string
          p_fallback_key: string
          p_ip_hash: string
          p_metadata?: Json
          p_placement_key: string
          p_user_agent_hash: string
        }
        Returns: Json
      }
      record_signup_attempt: {
        Args: {
          p_captcha_passed: boolean
          p_device_hash: string
          p_email_domain: string
          p_ip_hash: string
        }
        Returns: Json
      }
      redeem_perk_bundle: { Args: { p_reward_id: string }; Returns: Json }
      redeem_reward: { Args: { p_reward_id: string }; Returns: Json }
      refresh_ad_billing_snapshot: {
        Args: {
          p_campaign_id: string
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
      refresh_reward_item_inventory_counts: {
        Args: { p_reward_id: string }
        Returns: Json
      }
      refresh_reward_quantity_inventory_counts: {
        Args: { p_reward_id: string }
        Returns: Json
      }
      refund_reward_redemption: {
        Args: { p_reason?: string; p_redemption_id: string }
        Returns: Json
      }
      reward_available_inventory_counts: {
        Args: never
        Returns: {
          reward_id: string
          total_available: number
          total_uploaded: number
        }[]
      }
      sanitize_jsonb_strings: { Args: { input: Json }; Returns: Json }
      sanitize_text_value: { Args: { input: string }; Returns: string }
      sanitize_url_value: { Args: { input: string }; Returns: string }
      slugify_label: { Args: { p_value: string }; Returns: string }
      start_quiz_attempt: {
        Args: { p_lesson_id?: string; p_quiz_id: string }
        Returns: Json
      }
      submit_ad_sponsor_inquiry: {
        Args: {
          p_budget_range: string
          p_campaign_goal: string
          p_contact_name: string
          p_email: string
          p_metadata?: Json
          p_organization_name: string
          p_placement_interest: string
          p_role_title: string
          p_timing: string
          p_website_url: string
        }
        Returns: Json
      }
      submit_manual_redemption_details: {
        Args: { p_claim_data: Json; p_redemption_id: string }
        Returns: Json
      }
      track_referral_link_visit: {
        Args: {
          p_referral_code: string
          p_user_agent?: string
          p_visitor_key: string
        }
        Returns: Json
      }
      update_my_profile: {
        Args: { p_avatar_url?: string; p_display_name: string }
        Returns: Json
      }
      upsert_ad_frequency_counter: {
        Args: {
          p_campaign_id: string
          p_creative_id: string
          p_creative_version_id: string
          p_event_type: Database["public"]["Enums"]["ad_event_type"]
          p_partner_id: string
          p_placement_key: string
          p_scope_key_hash: string
          p_scope_type: Database["public"]["Enums"]["ad_frequency_scope_type"]
          p_timezone: string
          p_window_duration: string
          p_window_name: string
        }
        Returns: undefined
      }
    }
    Enums: {
      ad_asset_type: "image" | "logo" | "video" | "poster" | "caption"
      ad_campaign_type: "guaranteed" | "priority" | "house" | "bonus"
      ad_creative_format:
        | "native_card"
        | "image_banner"
        | "text_card"
        | "video_card"
      ad_entity_status:
        | "draft"
        | "submitted"
        | "approved"
        | "active"
        | "published"
        | "rejected"
        | "paused"
        | "archived"
      ad_event_type: "impression" | "viewable_impression" | "click"
      ad_frequency_scope_type:
        | "session"
        | "user"
        | "device"
        | "campaign"
        | "creative"
        | "partner"
        | "placement"
      ad_frequency_window_type: "rolling" | "calendar"
      ad_pacing_mode: "even" | "asap" | "manual"
      ad_pricing_model: "cpm" | "cpc" | "flat_fee" | "make_good" | "house"
      ad_qualification_status: "raw" | "filtered" | "qualified" | "billable"
      content_status: "draft" | "published" | "archived"
      course_level: "beginner" | "intermediate" | "advanced"
      lesson_content_block_type:
        | "text"
        | "image"
        | "video"
        | "audio"
        | "table"
        | "callout"
      lesson_page_type:
        | "primer"
        | "concept"
        | "example"
        | "reflection"
        | "summary"
      lesson_retry_mode: "disabled" | "anytime" | "cooldown"
      mission_category:
        | "course"
        | "referral"
        | "feedback"
        | "campaign"
        | "custom"
      mission_proof_type: "image" | "video" | "text" | "link" | "location"
      mission_repeatability:
        | "once"
        | "daily"
        | "weekly"
        | "campaign"
        | "per_referral"
      mission_validation_type:
        | "course_completed"
        | "lesson_completed"
        | "lesson_count_completed"
        | "referral_friend_completed_lessons"
        | "proof_upload"
        | "manual_review"
      quiz_answer_status:
        | "earned"
        | "missed"
        | "already_earned"
        | "daily_cap_deferred"
        | "practice"
      quiz_attempt_mode: "earning" | "practice"
      quiz_attempt_status:
        | "in_progress"
        | "graded"
        | "daily_cap_reached"
        | "practice_completed"
        | "abandoned"
      quiz_question_type: "single_choice" | "multiple_choice" | "true_false"
      redemption_status:
        | "requested"
        | "approved"
        | "fulfilled"
        | "rejected"
        | "cancelled"
      referral_status:
        | "signed_up"
        | "in_progress"
        | "qualified"
        | "awarded"
        | "rejected"
      review_status: "submitted" | "approved" | "rejected"
      xp_direction: "earn" | "spend"
      xp_source_type:
        | "quiz_question"
        | "mission"
        | "reward_redemption"
        | "adjustment"
        | "assessment"
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
      ad_asset_type: ["image", "logo", "video", "poster", "caption"],
      ad_campaign_type: ["guaranteed", "priority", "house", "bonus"],
      ad_creative_format: [
        "native_card",
        "image_banner",
        "text_card",
        "video_card",
      ],
      ad_entity_status: [
        "draft",
        "submitted",
        "approved",
        "active",
        "published",
        "rejected",
        "paused",
        "archived",
      ],
      ad_event_type: ["impression", "viewable_impression", "click"],
      ad_frequency_scope_type: [
        "session",
        "user",
        "device",
        "campaign",
        "creative",
        "partner",
        "placement",
      ],
      ad_frequency_window_type: ["rolling", "calendar"],
      ad_pacing_mode: ["even", "asap", "manual"],
      ad_pricing_model: ["cpm", "cpc", "flat_fee", "make_good", "house"],
      ad_qualification_status: ["raw", "filtered", "qualified", "billable"],
      content_status: ["draft", "published", "archived"],
      course_level: ["beginner", "intermediate", "advanced"],
      lesson_content_block_type: [
        "text",
        "image",
        "video",
        "audio",
        "table",
        "callout",
      ],
      lesson_page_type: [
        "primer",
        "concept",
        "example",
        "reflection",
        "summary",
      ],
      lesson_retry_mode: ["disabled", "anytime", "cooldown"],
      mission_category: [
        "course",
        "referral",
        "feedback",
        "campaign",
        "custom",
      ],
      mission_proof_type: ["image", "video", "text", "link", "location"],
      mission_repeatability: [
        "once",
        "daily",
        "weekly",
        "campaign",
        "per_referral",
      ],
      mission_validation_type: [
        "course_completed",
        "lesson_completed",
        "lesson_count_completed",
        "referral_friend_completed_lessons",
        "proof_upload",
        "manual_review",
      ],
      quiz_answer_status: [
        "earned",
        "missed",
        "already_earned",
        "daily_cap_deferred",
        "practice",
      ],
      quiz_attempt_mode: ["earning", "practice"],
      quiz_attempt_status: [
        "in_progress",
        "graded",
        "daily_cap_reached",
        "practice_completed",
        "abandoned",
      ],
      quiz_question_type: ["single_choice", "multiple_choice", "true_false"],
      redemption_status: [
        "requested",
        "approved",
        "fulfilled",
        "rejected",
        "cancelled",
      ],
      referral_status: [
        "signed_up",
        "in_progress",
        "qualified",
        "awarded",
        "rejected",
      ],
      review_status: ["submitted", "approved", "rejected"],
      xp_direction: ["earn", "spend"],
      xp_source_type: [
        "quiz_question",
        "mission",
        "reward_redemption",
        "adjustment",
        "assessment",
      ],
    },
  },
} as const
