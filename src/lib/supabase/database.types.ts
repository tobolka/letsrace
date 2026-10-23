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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          title?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      blocked_days: {
        Row: {
          created_at: string
          day: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      blocked_weekends: {
        Row: {
          created_at: string
          id: string
          note: string | null
          saturday: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          saturday: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          saturday?: string
          user_id?: string
        }
        Relationships: []
      }
      catalog_probes: {
        Row: {
          attempts: number
          event_id: string
          last_attempt_at: string
          outcome: string
          probe: string
        }
        Insert: {
          attempts?: number
          event_id: string
          last_attempt_at?: string
          outcome: string
          probe: string
        }
        Update: {
          attempts?: number
          event_id?: string
          last_attempt_at?: string
          outcome?: string
          probe?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_probes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      discovered_links: {
        Row: {
          created_at: string
          from_watched_url_id: string | null
          hint_kind: string | null
          id: string
          status: string
          url: string
        }
        Insert: {
          created_at?: string
          from_watched_url_id?: string | null
          hint_kind?: string | null
          id?: string
          status?: string
          url: string
        }
        Update: {
          created_at?: string
          from_watched_url_id?: string | null
          hint_kind?: string | null
          id?: string
          status?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovered_links_from_watched_url_id_fkey"
            columns: ["from_watched_url_id"]
            isOneToOne: false
            referencedRelation: "watched_urls"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_reviews: {
        Row: {
          created_at: string
          id: string
          left_id: string
          note: string | null
          right_id: string
          verdict: string
        }
        Insert: {
          created_at?: string
          id?: string
          left_id: string
          note?: string | null
          right_id: string
          verdict: string
        }
        Update: {
          created_at?: string
          id?: string
          left_id?: string
          note?: string | null
          right_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_reviews_left_id_fkey"
            columns: ["left_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_reviews_right_id_fkey"
            columns: ["right_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendance: {
        Row: {
          created_at: string
          event_id: string
          id: string
          member_id: string
          notes: string | null
          paid: boolean
          registered: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          member_id: string
          notes?: string | null
          paid?: boolean
          registered?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          member_id?: string
          notes?: string | null
          paid?: boolean
          registered?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_categories: {
        Row: {
          age_max: number | null
          age_min: number | null
          audience: string | null
          distance_km: number | null
          elevation_m: number | null
          event_id: string
          gender: string | null
          id: string
          name: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          audience?: string | null
          distance_km?: number | null
          elevation_m?: number | null
          event_id: string
          gender?: string | null
          id?: string
          name: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          audience?: string | null
          distance_km?: number | null
          elevation_m?: number | null
          event_id?: string
          gender?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_facts: {
        Row: {
          created_at: string
          event_id: string
          field: string
          id: string
          method: string
          model: string | null
          previous: Json | null
          quote: string | null
          source_url: string | null
          status: string
          value: Json | null
          version: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          field: string
          id?: string
          method: string
          model?: string | null
          previous?: Json | null
          quote?: string | null
          source_url?: string | null
          status?: string
          value?: Json | null
          version?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          field?: string
          id?: string
          method?: string
          model?: string | null
          previous?: Json | null
          quote?: string | null
          source_url?: string | null
          status?: string
          value?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_facts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_favorites: {
        Row: {
          created_at: string
          event_id: string
          fee_amount: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          fee_amount?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          fee_amount?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_favorites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_overrides: {
        Row: {
          event_id: string
          fields: Json
          id: string
          locked_fields: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          event_id: string
          fields?: Json
          id?: string
          locked_fields?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          event_id?: string
          fields?: Json
          id?: string
          locked_fields?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_overrides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_plan_changes: {
        Row: {
          created_at: string
          event_id: string
          fingerprint: string
          id: string
          kind: string
          payload: Json
        }
        Insert: {
          created_at?: string
          event_id: string
          fingerprint: string
          id?: string
          kind: string
          payload?: Json
        }
        Update: {
          created_at?: string
          event_id?: string
          fingerprint?: string
          id?: string
          kind?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "event_plan_changes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series: {
        Row: {
          created_at: string
          event_id: string
          is_primary: boolean
          series_id: string
          source: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          is_primary?: boolean
          series_id: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          is_primary?: boolean
          series_id?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_series_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sources: {
        Row: {
          created_at: string
          event_id: string
          external_id: string | null
          id: string
          is_canonical: boolean
          kind: string
          raw_hash: string | null
          source_url: string
          watched_url_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          external_id?: string | null
          id?: string
          is_canonical?: boolean
          kind?: string
          raw_hash?: string | null
          source_url: string
          watched_url_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          external_id?: string | null
          id?: string
          is_canonical?: boolean
          kind?: string
          raw_hash?: string | null
          source_url?: string
          watched_url_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sources_watched_url_id_fkey"
            columns: ["watched_url_id"]
            isOneToOne: false
            referencedRelation: "watched_urls"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          age_categories: string[]
          age_confidence: string | null
          audience: string
          class_label: string | null
          competition_type: string
          created_at: string
          description: string | null
          disciplines: string[]
          end_date: string | null
          event_type: string
          fingerprint: string
          formats: string[]
          id: string
          last_seen_at: string
          level: string
          location_id: string | null
          merged_into_id: string | null
          name: string
          name_normalized: string
          registration_closes_at: string | null
          registration_opens_at: string | null
          registration_url: string | null
          regulations_url: string | null
          results_url: string | null
          search_text: string | null
          season: string | null
          series_id: string | null
          slug: string
          source_kind: string
          start_date: string
          status: string
          timezone: string
          uci_class: string | null
          updated_at: string
          visibility: string
          website_url: string | null
        }
        Insert: {
          age_categories?: string[]
          age_confidence?: string | null
          audience?: string
          class_label?: string | null
          competition_type?: string
          created_at?: string
          description?: string | null
          disciplines?: string[]
          end_date?: string | null
          event_type?: string
          fingerprint: string
          formats?: string[]
          id?: string
          last_seen_at?: string
          level?: string
          location_id?: string | null
          merged_into_id?: string | null
          name: string
          name_normalized: string
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          registration_url?: string | null
          regulations_url?: string | null
          results_url?: string | null
          search_text?: string | null
          season?: string | null
          series_id?: string | null
          slug: string
          source_kind?: string
          start_date: string
          status?: string
          timezone?: string
          uci_class?: string | null
          updated_at?: string
          visibility?: string
          website_url?: string | null
        }
        Update: {
          age_categories?: string[]
          age_confidence?: string | null
          audience?: string
          class_label?: string | null
          competition_type?: string
          created_at?: string
          description?: string | null
          disciplines?: string[]
          end_date?: string | null
          event_type?: string
          fingerprint?: string
          formats?: string[]
          id?: string
          last_seen_at?: string
          level?: string
          location_id?: string | null
          merged_into_id?: string | null
          name?: string
          name_normalized?: string
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          registration_url?: string | null
          regulations_url?: string | null
          results_url?: string | null
          search_text?: string | null
          season?: string | null
          series_id?: string | null
          slug?: string
          source_kind?: string
          start_date?: string
          status?: string
          timezone?: string
          uci_class?: string | null
          updated_at?: string
          visibility?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_profiles: {
        Row: {
          created_at: string
          fail_count: number
          host: string
          id: string
          last_success_at: string | null
          recipe: Json
          strategy: string
          success_count: number
          url_pattern: string | null
        }
        Insert: {
          created_at?: string
          fail_count?: number
          host: string
          id?: string
          last_success_at?: string | null
          recipe?: Json
          strategy: string
          success_count?: number
          url_pattern?: string | null
        }
        Update: {
          created_at?: string
          fail_count?: number
          host?: string
          id?: string
          last_success_at?: string | null
          recipe?: Json
          strategy?: string
          success_count?: number
          url_pattern?: string | null
        }
        Relationships: []
      }
      family_members: {
        Row: {
          birth_year: number | null
          busy_weekdays: number[]
          created_at: string
          id: string
          is_self: boolean
          name: string
          preferred_disciplines: string[]
          relationship: string
          user_id: string
        }
        Insert: {
          birth_year?: number | null
          busy_weekdays?: number[]
          created_at?: string
          id?: string
          is_self?: boolean
          name: string
          preferred_disciplines?: string[]
          relationship?: string
          user_id: string
        }
        Update: {
          birth_year?: number | null
          busy_weekdays?: number[]
          created_at?: string
          id?: string
          is_self?: boolean
          name?: string
          preferred_disciplines?: string[]
          relationship?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_requests: {
        Row: {
          created_at: string
          email: string | null
          id: string
          kind: string
          message: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          message: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          message?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ingest_runs: {
        Row: {
          error: string | null
          events_upserted: number
          finished_at: string | null
          http_status: number | null
          id: string
          links_discovered: number
          ok: boolean | null
          started_at: string
          strategy: string | null
          watched_url_id: string | null
        }
        Insert: {
          error?: string | null
          events_upserted?: number
          finished_at?: string | null
          http_status?: number | null
          id?: string
          links_discovered?: number
          ok?: boolean | null
          started_at?: string
          strategy?: string | null
          watched_url_id?: string | null
        }
        Update: {
          error?: string | null
          events_upserted?: number
          finished_at?: string | null
          http_status?: number | null
          id?: string
          links_discovered?: number
          ok?: boolean | null
          started_at?: string
          strategy?: string | null
          watched_url_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingest_runs_watched_url_id_fkey"
            columns: ["watched_url_id"]
            isOneToOne: false
            referencedRelation: "watched_urls"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          country_code: string
          created_at: string
          geocode_query: string | null
          geocode_status: string
          geog: unknown
          id: string
          lat: number | null
          lng: number | null
          municipality: string | null
          name: string
          region: string | null
          region_code: string | null
          timezone: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          country_code: string
          created_at?: string
          geocode_query?: string | null
          geocode_status?: string
          geog?: unknown
          id?: string
          lat?: number | null
          lng?: number | null
          municipality?: string | null
          name: string
          region?: string | null
          region_code?: string | null
          timezone?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          geocode_query?: string | null
          geocode_status?: string
          geog?: unknown
          id?: string
          lat?: number | null
          lng?: number | null
          municipality?: string | null
          name?: string
          region?: string | null
          region_code?: string | null
          timezone?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      page_reads: {
        Row: {
          read_at: string
          reader: string
          text_hash: string
          url: string
        }
        Insert: {
          read_at?: string
          reader: string
          text_hash: string
          url: string
        }
        Update: {
          read_at?: string
          reader?: string
          text_hash?: string
          url?: string
        }
        Relationships: []
      }
      plan_change_deliveries: {
        Row: {
          change_id: string
          created_at: string
          emailed_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          change_id: string
          created_at?: string
          emailed_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          change_id?: string
          created_at?: string
          emailed_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_change_deliveries_change_id_fkey"
            columns: ["change_id"]
            isOneToOne: false
            referencedRelation: "event_plan_changes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_change_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_digest_deliveries: {
        Row: {
          created_at: string
          emailed_at: string | null
          user_id: string
          week_key: string
        }
        Insert: {
          created_at?: string
          emailed_at?: string | null
          user_id: string
          week_key: string
        }
        Update: {
          created_at?: string
          emailed_at?: string | null
          user_id?: string
          week_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_digest_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          busy_weekdays: number[]
          created_at: string
          digest_mail: boolean
          display_name: string | null
          email: string | null
          ics_token: string
          id: string
          locale: string
          plan_mail: boolean
          preferred_disciplines: string[]
          updated_at: string
        }
        Insert: {
          busy_weekdays?: number[]
          created_at?: string
          digest_mail?: boolean
          display_name?: string | null
          email?: string | null
          ics_token?: string
          id: string
          locale?: string
          plan_mail?: boolean
          preferred_disciplines?: string[]
          updated_at?: string
        }
        Update: {
          busy_weekdays?: number[]
          created_at?: string
          digest_mail?: boolean
          display_name?: string | null
          email?: string | null
          ics_token?: string
          id?: string
          locale?: string
          plan_mail?: boolean
          preferred_disciplines?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      race_alert_deliveries: {
        Row: {
          alert_id: string
          created_at: string
          distance_km: number | null
          emailed_at: string | null
          event_id: string
          id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          distance_km?: number | null
          emailed_at?: string | null
          event_id: string
          id?: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          distance_km?: number | null
          emailed_at?: string | null
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_alert_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "race_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_alert_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      race_alerts: {
        Row: {
          created_at: string
          disciplines: string[]
          enabled: boolean
          id: string
          label: string
          lat: number
          lng: number
          locale: string
          radius_km: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disciplines?: string[]
          enabled?: boolean
          id?: string
          label?: string
          lat: number
          lng: number
          locale?: string
          radius_km?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disciplines?: string[]
          enabled?: boolean
          id?: string
          label?: string
          lat?: number
          lng?: number
          locale?: string
          radius_km?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      race_submissions: {
        Row: {
          created_at: string
          id: string
          kind: string
          note: string | null
          status: string
          url: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          status?: string
          url: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          status?: string
          url?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "race_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          age_categories: string[]
          age_categories_confirmed_at: string | null
          age_categories_note: string | null
          audience_hint: string
          competition_type: string
          country_code: string | null
          created_at: string
          description: string | null
          disciplines: string[]
          id: string
          last_seen_at: string
          level: string
          name: string
          name_normalized: string | null
          season: string | null
          series_type: string
          short_name: string | null
          slug: string
          source_kind: string
          source_url: string | null
          status: string
          updated_at: string
          visibility: string
          website_url: string | null
        }
        Insert: {
          age_categories?: string[]
          age_categories_confirmed_at?: string | null
          age_categories_note?: string | null
          audience_hint?: string
          competition_type?: string
          country_code?: string | null
          created_at?: string
          description?: string | null
          disciplines?: string[]
          id?: string
          last_seen_at?: string
          level?: string
          name: string
          name_normalized?: string | null
          season?: string | null
          series_type?: string
          short_name?: string | null
          slug: string
          source_kind?: string
          source_url?: string | null
          status?: string
          updated_at?: string
          visibility?: string
          website_url?: string | null
        }
        Update: {
          age_categories?: string[]
          age_categories_confirmed_at?: string | null
          age_categories_note?: string | null
          audience_hint?: string
          competition_type?: string
          country_code?: string | null
          created_at?: string
          description?: string | null
          disciplines?: string[]
          id?: string
          last_seen_at?: string
          level?: string
          name?: string
          name_normalized?: string | null
          season?: string | null
          series_type?: string
          short_name?: string | null
          slug?: string
          source_kind?: string
          source_url?: string | null
          status?: string
          updated_at?: string
          visibility?: string
          website_url?: string | null
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      watched_urls: {
        Row: {
          added_by: string | null
          content_hash: string | null
          created_at: string
          etag: string | null
          extraction_profile_id: string | null
          http_status: number | null
          id: string
          kind: string
          last_changed_at: string | null
          last_error: string | null
          last_extract_status: string | null
          last_fetched_at: string | null
          last_modified: string | null
          next_poll_at: string
          notes: string | null
          parent_id: string | null
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          added_by?: string | null
          content_hash?: string | null
          created_at?: string
          etag?: string | null
          extraction_profile_id?: string | null
          http_status?: number | null
          id?: string
          kind: string
          last_changed_at?: string | null
          last_error?: string | null
          last_extract_status?: string | null
          last_fetched_at?: string | null
          last_modified?: string | null
          next_poll_at?: string
          notes?: string | null
          parent_id?: string | null
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          added_by?: string | null
          content_hash?: string | null
          created_at?: string
          etag?: string | null
          extraction_profile_id?: string | null
          http_status?: number | null
          id?: string
          kind?: string
          last_changed_at?: string | null
          last_error?: string | null
          last_extract_status?: string | null
          last_fetched_at?: string | null
          last_modified?: string | null
          next_poll_at?: string
          notes?: string | null
          parent_id?: string | null
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "watched_urls_extraction_profile_id_fkey"
            columns: ["extraction_profile_id"]
            isOneToOne: false
            referencedRelation: "extraction_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watched_urls_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "watched_urls"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      app_age_rank: {
        Args: { ages: string[]; confidence: string }
        Returns: number
      }
      app_fill_event_from: {
        Args: { drop_id: string; keep_id: string }
        Returns: undefined
      }
      app_insert_watched_url: {
        Args: { p_added_by?: string; p_kind: string; p_url: string }
        Returns: string
      }
      app_merge_events: {
        Args: { drop_id: string; keep_id: string }
        Returns: string
      }
      app_set_discovered_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      app_update_watched_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      event_search_text: {
        Args: { eid: string; ename: string; esid: string }
        Returns: string
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      search_event_ids: {
        Args: {
          date_from: string
          date_to?: string
          max_results?: number
          q: string
        }
        Returns: {
          event_id: string
          fuzzy: boolean
          score: number
        }[]
      }
      search_fold: { Args: { t: string }; Returns: string }
      set_location_geog: {
        Args: { lat: number; lng: number; loc_id: string }
        Returns: undefined
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
