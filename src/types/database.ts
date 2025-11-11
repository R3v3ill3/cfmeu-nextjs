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
      activities: {
        Row: {
          created_at: string
          created_by: string | null
          employer_id: string | null
          id: string
          job_site_id: string | null
          metadata: Json
          notes: string | null
          project_id: string | null
          topic: string | null
          type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employer_id?: string | null
          id?: string
          job_site_id?: string | null
          metadata?: Json
          notes?: string | null
          project_id?: string | null
          topic?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employer_id?: string | null
          id?: string
          job_site_id?: string | null
          metadata?: Json
          notes?: string | null
          project_id?: string | null
          topic?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "activities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "activities_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "activities_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      activity_delegations: {
        Row: {
          activity_id: string
          assigned_worker_id: string
          assignment_type: string | null
          created_at: string
          delegate_worker_id: string
          id: string
          source_activity_id: string | null
          updated_at: string
        }
        Insert: {
          activity_id: string
          assigned_worker_id: string
          assignment_type?: string | null
          created_at?: string
          delegate_worker_id: string
          id?: string
          source_activity_id?: string | null
          updated_at?: string
        }
        Update: {
          activity_id?: string
          assigned_worker_id?: string
          assignment_type?: string | null
          created_at?: string
          delegate_worker_id?: string
          id?: string
          source_activity_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      activity_objective_targets: {
        Row: {
          created_at: string
          dimension: string
          dimension_id: string
          id: string
          objective_id: string
          target_value: number
        }
        Insert: {
          created_at?: string
          dimension: string
          dimension_id: string
          id?: string
          objective_id: string
          target_value: number
        }
        Update: {
          created_at?: string
          dimension?: string
          dimension_id?: string
          id?: string
          objective_id?: string
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_objective_targets_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "activity_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_objectives: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          name: string
          target_kind: string
          target_value: number
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          name: string
          target_kind: string
          target_value: number
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          name?: string
          target_kind?: string
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_objectives_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "union_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_participants: {
        Row: {
          activity_id: string
          assignment_method: string
          assignment_source_id: string | null
          created_at: string
          id: string
          notes: string | null
          participation_status: string | null
          updated_at: string
          worker_id: string
        }
        Insert: {
          activity_id: string
          assignment_method: string
          assignment_source_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          participation_status?: string | null
          updated_at?: string
          worker_id: string
        }
        Update: {
          activity_id?: string
          assignment_method?: string
          assignment_source_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          participation_status?: string | null
          updated_at?: string
          worker_id?: string
        }
        Relationships: []
      }
      activity_rating_definitions: {
        Row: {
          activity_id: string
          created_at: string
          definition: string | null
          id: string
          label: string
          level: number
        }
        Insert: {
          activity_id: string
          created_at?: string
          definition?: string | null
          id?: string
          label: string
          level: number
        }
        Update: {
          activity_id?: string
          created_at?: string
          definition?: string | null
          id?: string
          label?: string
          level?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_rating_definitions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "union_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_templates: {
        Row: {
          category: string
          created_at: string
          default_rating_criteria: Json | null
          description: string | null
          id: string
          is_predefined: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          default_rating_criteria?: Json | null
          description?: string | null
          id?: string
          is_predefined?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_rating_criteria?: Json | null
          description?: string | null
          id?: string
          is_predefined?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      activity_workers: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          worker_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          worker_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_workers_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "union_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "unallocated_workers_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      approval_history: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          new_status: string
          performed_at: string
          performed_by: string
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          new_status: string
          performed_at?: string
          performed_by: string
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          new_status?: string
          performed_at?: string
          performed_by?: string
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      automation_rate_limits: {
        Row: {
          created_at: string
          last_run_at: string
          task: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_run_at?: string
          task: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_run_at?: string
          task?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_uploads: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          original_file_name: string
          original_file_size_bytes: number
          original_file_url: string
          processing_completed_at: string | null
          processing_started_at: string | null
          project_definitions: Json
          projects_completed: number | null
          status: string
          total_pages: number
          total_projects: number
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          original_file_name: string
          original_file_size_bytes: number
          original_file_url: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          project_definitions?: Json
          projects_completed?: number | null
          status?: string
          total_pages: number
          total_projects: number
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          original_file_name?: string
          original_file_size_bytes?: number
          original_file_url?: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          project_definitions?: Json
          projects_completed?: number | null
          status?: string
          total_pages?: number
          total_projects?: number
          uploaded_by?: string
        }
        Relationships: []
      }
      campaign_assignments: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          job_site_id: string | null
          organiser_id: string | null
          patch_id: string | null
          project_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          job_site_id?: string | null
          organiser_id?: string | null
          patch_id?: string | null
          project_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          job_site_id?: string | null
          organiser_id?: string | null
          patch_id?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_assignments_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_assignments_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "campaign_assignments_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "campaign_assignments_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "campaign_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "campaign_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "campaign_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      campaign_kpis: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string
          id: string
          kpi_id: string
          required: boolean
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by: string
          id?: string
          kpi_id: string
          required?: boolean
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string
          id?: string
          kpi_id?: string
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "campaign_kpis_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_kpis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_kpis_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_eba_records: {
        Row: {
          agreement_title: string | null
          approved_date: string | null
          comments: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          date_barg_docs_sent: string | null
          date_draft_signing_sent: string | null
          date_eba_signed: string | null
          date_vote_occurred: string | null
          docs_prepared: string | null
          eba_data_form_received: string | null
          eba_document_url: string | null
          eba_file_number: string | null
          eba_lodged_fwc: string | null
          employer_id: string | null
          followup_email_sent: string | null
          followup_phone_call: string | null
          fwc_certified_date: string | null
          fwc_document_url: string | null
          fwc_lodgement_number: string | null
          fwc_matter_number: string | null
          id: string
          nominal_expiry_date: string | null
          out_of_office_received: string | null
          sector: string | null
          status: string | null
          summary_url: string | null
          updated_at: string
          wage_rates_url: string | null
        }
        Insert: {
          agreement_title?: string | null
          approved_date?: string | null
          comments?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          date_barg_docs_sent?: string | null
          date_draft_signing_sent?: string | null
          date_eba_signed?: string | null
          date_vote_occurred?: string | null
          docs_prepared?: string | null
          eba_data_form_received?: string | null
          eba_document_url?: string | null
          eba_file_number?: string | null
          eba_lodged_fwc?: string | null
          employer_id?: string | null
          followup_email_sent?: string | null
          followup_phone_call?: string | null
          fwc_certified_date?: string | null
          fwc_document_url?: string | null
          fwc_lodgement_number?: string | null
          fwc_matter_number?: string | null
          id?: string
          nominal_expiry_date?: string | null
          out_of_office_received?: string | null
          sector?: string | null
          status?: string | null
          summary_url?: string | null
          updated_at?: string
          wage_rates_url?: string | null
        }
        Update: {
          agreement_title?: string | null
          approved_date?: string | null
          comments?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          date_barg_docs_sent?: string | null
          date_draft_signing_sent?: string | null
          date_eba_signed?: string | null
          date_vote_occurred?: string | null
          docs_prepared?: string | null
          eba_data_form_received?: string | null
          eba_document_url?: string | null
          eba_file_number?: string | null
          eba_lodged_fwc?: string | null
          employer_id?: string | null
          followup_email_sent?: string | null
          followup_phone_call?: string | null
          fwc_certified_date?: string | null
          fwc_document_url?: string | null
          fwc_lodgement_number?: string | null
          fwc_matter_number?: string | null
          id?: string
          nominal_expiry_date?: string | null
          out_of_office_received?: string | null
          sector?: string | null
          status?: string | null
          summary_url?: string | null
          updated_at?: string
          wage_rates_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_eba_records_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "company_eba_records_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_eba_records_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_eba_records_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_eba_records_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
        ]
      }
      compliance_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string | null
          due_date: string | null
          entity_id: string
          entity_type: string
          id: string
          message: string
          project_id: string
          severity: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string | null
          due_date?: string | null
          entity_id: string
          entity_type: string
          id?: string
          message: string
          project_id: string
          severity: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string | null
          due_date?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          message?: string
          project_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "compliance_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "compliance_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "compliance_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      contractor_role_types: {
        Row: {
          category: string
          code: string
          created_at: string | null
          description: string | null
          hierarchy_level: number | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          description?: string | null
          hierarchy_level?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          description?: string | null
          hierarchy_level?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contractor_trade_capabilities: {
        Row: {
          created_at: string | null
          employer_id: string | null
          id: string
          is_primary: boolean | null
          notes: string | null
          trade_type: Database["public"]["Enums"]["trade_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employer_id?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          trade_type: Database["public"]["Enums"]["trade_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employer_id?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          trade_type?: Database["public"]["Enums"]["trade_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_trade_capabilities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "contractor_trade_capabilities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_trade_capabilities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_trade_capabilities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_trade_capabilities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
        ]
      }
      dd_conversion_attempt: {
        Row: {
          client_generated_id: string
          created_at: string
          id: string
          method_code: string
          outcome_code: string
          site_visit_id: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          client_generated_id: string
          created_at?: string
          id?: string
          method_code: string
          outcome_code: string
          site_visit_id: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          client_generated_id?: string
          created_at?: string
          id?: string
          method_code?: string
          outcome_code?: string
          site_visit_id?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_conversion_attempt_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_conversion_attempt_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["id"]
          },
        ]
      }
      delegate_assessment: {
        Row: {
          created_at: string
          id: string
          present: boolean
          site_visit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          present?: boolean
          site_visit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          present?: boolean
          site_visit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegate_assessment_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegate_assessment_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["id"]
          },
        ]
      }
      delegate_field_permissions: {
        Row: {
          can_edit: boolean
          created_at: string
          entity_field_id: string
          id: string
          organiser_id: string
          updated_at: string
        }
        Insert: {
          can_edit?: boolean
          created_at?: string
          entity_field_id: string
          id?: string
          organiser_id: string
          updated_at?: string
        }
        Update: {
          can_edit?: boolean
          created_at?: string
          entity_field_id?: string
          id?: string
          organiser_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegate_field_permissions_entity_field_id_fkey"
            columns: ["entity_field_id"]
            isOneToOne: false
            referencedRelation: "entity_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegate_field_permissions_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delegate_role_rating: {
        Row: {
          created_at: string
          delegate_assessment_id: string
          id: string
          rating_code: string
          role_type_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delegate_assessment_id: string
          id?: string
          rating_code: string
          role_type_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delegate_assessment_id?: string
          id?: string
          rating_code?: string
          role_type_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegate_role_rating_delegate_assessment_id_fkey"
            columns: ["delegate_assessment_id"]
            isOneToOne: false
            referencedRelation: "delegate_assessment"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_lead_organiser_links: {
        Row: {
          assigned_by: string | null
          created_at: string
          draft_lead_pending_user_id: string
          end_date: string | null
          id: string
          is_active: boolean
          organiser_pending_user_id: string | null
          organiser_user_id: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          draft_lead_pending_user_id: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          organiser_pending_user_id?: string | null
          organiser_user_id?: string | null
          start_date?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          draft_lead_pending_user_id?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          organiser_pending_user_id?: string | null
          organiser_user_id?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_lead_organiser_links_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_lead_organiser_links_draft_lead_pending_user_id_fkey"
            columns: ["draft_lead_pending_user_id"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_lead_organiser_links_organiser_pending_user_id_fkey"
            columns: ["organiser_pending_user_id"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_lead_organiser_links_organiser_user_id_fkey"
            columns: ["organiser_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_aliases: {
        Row: {
          alias: string
          alias_normalized: string
          collected_at: string | null
          collected_by: string | null
          created_at: string
          created_by: string | null
          employer_id: string
          id: string
          is_authoritative: boolean
          notes: string | null
          source_identifier: string | null
          source_system: string | null
          updated_at: string | null
        }
        Insert: {
          alias: string
          alias_normalized: string
          collected_at?: string | null
          collected_by?: string | null
          created_at?: string
          created_by?: string | null
          employer_id: string
          id?: string
          is_authoritative?: boolean
          notes?: string | null
          source_identifier?: string | null
          source_system?: string | null
          updated_at?: string | null
        }
        Update: {
          alias?: string
          alias_normalized?: string
          collected_at?: string | null
          collected_by?: string | null
          created_at?: string
          created_by?: string | null
          employer_id?: string
          id?: string
          is_authoritative?: boolean
          notes?: string | null
          source_identifier?: string | null
          source_system?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_aliases_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "employer_aliases_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_aliases_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_aliases_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_aliases_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
        ]
      }
      employer_canonical_audit: {
        Row: {
          action: string
          alias_id: string | null
          conflict_warnings: Json | null
          created_at: string
          decided_at: string
          decided_by: string | null
          decision_rationale: string | null
          employer_id: string
          id: string
          is_authoritative: boolean | null
          previous_canonical_name: string
          proposed_canonical_name: string
          source_system: string | null
        }
        Insert: {
          action: string
          alias_id?: string | null
          conflict_warnings?: Json | null
          created_at?: string
          decided_at?: string
          decided_by?: string | null
          decision_rationale?: string | null
          employer_id: string
          id?: string
          is_authoritative?: boolean | null
          previous_canonical_name: string
          proposed_canonical_name: string
          source_system?: string | null
        }
        Update: {
          action?: string
          alias_id?: string | null
          conflict_warnings?: Json | null
          created_at?: string
          decided_at?: string
          decided_by?: string | null
          decision_rationale?: string | null
          employer_id?: string
          id?: string
          is_authoritative?: boolean | null
          previous_canonical_name?: string
          proposed_canonical_name?: string
          source_system?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_canonical_audit_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_canonical_audit_alias_id_fkey"
            columns: ["alias_id"]
            isOneToOne: false
            referencedRelation: "employer_aliases"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_capabilities: {
        Row: {
          capability_type: string
          certification_details: Json | null
          contractor_role_type_id: string | null
          created_at: string | null
          employer_id: string
          id: string
          is_primary: boolean | null
          notes: string | null
          proficiency_level: string | null
          trade_type_id: string | null
          updated_at: string | null
          years_experience: number | null
        }
        Insert: {
          capability_type: string
          certification_details?: Json | null
          contractor_role_type_id?: string | null
          created_at?: string | null
          employer_id: string
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          proficiency_level?: string | null
          trade_type_id?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Update: {
          capability_type?: string
          certification_details?: Json | null
          contractor_role_type_id?: string | null
          created_at?: string | null
          employer_id?: string
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          proficiency_level?: string | null
          trade_type_id?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_capabilities_contractor_role_type_id_fkey"
            columns: ["contractor_role_type_id"]
            isOneToOne: false
            referencedRelation: "contractor_role_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_capabilities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "employer_capabilities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_capabilities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_capabilities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_capabilities_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "employer_capabilities_trade_type_id_fkey"
            columns: ["trade_type_id"]
            isOneToOne: false
            referencedRelation: "trade_types"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_compliance_checks: {
        Row: {
          cbus_check_conducted: boolean | null
          cbus_check_date: string | null
          cbus_checked_by: string[] | null
          cbus_enforcement_flag: boolean | null
          cbus_followup_required: boolean | null
          cbus_notes: string | null
          cbus_payment_status: string | null
          cbus_payment_timing: string | null
          cbus_worker_count_status: string | null
          created_at: string | null
          effective_from: string | null
          effective_to: string | null
          employer_id: string
          id: string
          incolink_check_conducted: boolean | null
          incolink_check_date: string | null
          incolink_checked_by: string[] | null
          incolink_company_id: string | null
          incolink_enforcement_flag: boolean | null
          incolink_followup_required: boolean | null
          incolink_notes: string | null
          incolink_payment_status: string | null
          incolink_payment_timing: string | null
          incolink_worker_count_status: string | null
          is_current: boolean | null
          project_id: string
          site_visit_id: string | null
          updated_at: string | null
          updated_by: string | null
          version: number | null
        }
        Insert: {
          cbus_check_conducted?: boolean | null
          cbus_check_date?: string | null
          cbus_checked_by?: string[] | null
          cbus_enforcement_flag?: boolean | null
          cbus_followup_required?: boolean | null
          cbus_notes?: string | null
          cbus_payment_status?: string | null
          cbus_payment_timing?: string | null
          cbus_worker_count_status?: string | null
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          employer_id: string
          id?: string
          incolink_check_conducted?: boolean | null
          incolink_check_date?: string | null
          incolink_checked_by?: string[] | null
          incolink_company_id?: string | null
          incolink_enforcement_flag?: boolean | null
          incolink_followup_required?: boolean | null
          incolink_notes?: string | null
          incolink_payment_status?: string | null
          incolink_payment_timing?: string | null
          incolink_worker_count_status?: string | null
          is_current?: boolean | null
          project_id: string
          site_visit_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          cbus_check_conducted?: boolean | null
          cbus_check_date?: string | null
          cbus_checked_by?: string[] | null
          cbus_enforcement_flag?: boolean | null
          cbus_followup_required?: boolean | null
          cbus_notes?: string | null
          cbus_payment_status?: string | null
          cbus_payment_timing?: string | null
          cbus_worker_count_status?: string | null
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          employer_id?: string
          id?: string
          incolink_check_conducted?: boolean | null
          incolink_check_date?: string | null
          incolink_checked_by?: string[] | null
          incolink_company_id?: string | null
          incolink_enforcement_flag?: boolean | null
          incolink_followup_required?: boolean | null
          incolink_notes?: string | null
          incolink_payment_status?: string | null
          incolink_payment_timing?: string | null
          incolink_worker_count_status?: string | null
          is_current?: boolean | null
          project_id?: string
          site_visit_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_compliance_checks_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_compliance_checks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_organisers: {
        Row: {
          created_at: string
          employer_id: string
          id: string
          organiser_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employer_id: string
          id?: string
          organiser_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employer_id?: string
          id?: string
          organiser_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_organisers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "employer_organisers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_organisers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_organisers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_organisers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "employer_organisers_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_role_tags: {
        Row: {
          created_at: string
          employer_id: string
          id: string
          tag: Database["public"]["Enums"]["employer_role_tag"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          employer_id: string
          id?: string
          tag: Database["public"]["Enums"]["employer_role_tag"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          employer_id?: string
          id?: string
          tag?: Database["public"]["Enums"]["employer_role_tag"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_role_tags_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "employer_role_tags_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_role_tags_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_role_tags_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_role_tags_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
        ]
      }
      employers: {
        Row: {
          abn: string | null
          address_line_1: string | null
          address_line_2: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          bci_company_id: string | null
          contact_notes: string | null
          created_at: string | null
          email: string | null
          employer_type: Database["public"]["Enums"]["employer_type"]
          enterprise_agreement_status: boolean | null
          eba_status_source: Database["public"]["Enums"]["eba_status_source"] | null
          eba_status_updated_at: string | null
          eba_status_notes: string | null
          eba_status_source: Database["public"]["Enums"]["eba_status_source"] | null
          eba_status_updated_at: string | null
          eba_status_notes: string | null
          eba_status_source: Database["public"]["Enums"]["eba_status_source"] | null
          eba_status_updated_at: string | null
          eba_status_notes: string | null
          estimated_worker_count: number | null
          id: string
          incolink_id: string | null
          incolink_last_matched: string | null
          last_incolink_payment: string | null
          name: string
          parent_employer_id: string | null
          phone: string | null
          postcode: string | null
          primary_contact_name: string | null
          rejection_reason: string | null
          state: string | null
          suburb: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          abn?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bci_company_id?: string | null
          contact_notes?: string | null
          created_at?: string | null
          email?: string | null
          employer_type: Database["public"]["Enums"]["employer_type"]
          enterprise_agreement_status?: boolean | null
          eba_status_source?: Database["public"]["Enums"]["eba_status_source"] | null
          eba_status_updated_at?: string | null
          eba_status_notes?: string | null
          estimated_worker_count?: number | null
          id?: string
          incolink_id?: string | null
          incolink_last_matched?: string | null
          last_incolink_payment?: string | null
          name: string
          parent_employer_id?: string | null
          phone?: string | null
          postcode?: string | null
          primary_contact_name?: string | null
          rejection_reason?: string | null
          state?: string | null
          suburb?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          abn?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bci_company_id?: string | null
          contact_notes?: string | null
          created_at?: string | null
          email?: string | null
          employer_type?: Database["public"]["Enums"]["employer_type"]
          enterprise_agreement_status?: boolean | null
          eba_status_source?: Database["public"]["Enums"]["eba_status_source"] | null
          eba_status_updated_at?: string | null
          eba_status_notes?: string | null
          estimated_worker_count?: number | null
          id?: string
          incolink_id?: string | null
          incolink_last_matched?: string | null
          last_incolink_payment?: string | null
          name?: string
          parent_employer_id?: string | null
          phone?: string | null
          postcode?: string | null
          primary_contact_name?: string | null
          rejection_reason?: string | null
          state?: string | null
          suburb?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employers_parent_employer_id_fkey"
            columns: ["parent_employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "employers_parent_employer_id_fkey"
            columns: ["parent_employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employers_parent_employer_id_fkey"
            columns: ["parent_employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employers_parent_employer_id_fkey"
            columns: ["parent_employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employers_parent_employer_id_fkey"
            columns: ["parent_employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
        ]
      }
      entitlements_audit: {
        Row: {
          created_at: string
          eba_allowances_correct: boolean
          id: string
          redundancy_contributions_up_to_date: boolean
          site_visit_id: string
          super_paid: boolean
          super_paid_to_fund: boolean
          updated_at: string
          wages_correct: boolean
        }
        Insert: {
          created_at?: string
          eba_allowances_correct?: boolean
          id?: string
          redundancy_contributions_up_to_date?: boolean
          site_visit_id: string
          super_paid?: boolean
          super_paid_to_fund?: boolean
          updated_at?: string
          wages_correct?: boolean
        }
        Update: {
          created_at?: string
          eba_allowances_correct?: boolean
          id?: string
          redundancy_contributions_up_to_date?: boolean
          site_visit_id?: string
          super_paid?: boolean
          super_paid_to_fund?: boolean
          updated_at?: string
          wages_correct?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_audit_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_audit_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_fields: {
        Row: {
          created_at: string
          default_editable: boolean
          default_viewable: boolean
          entity_type: string
          field_label: string
          field_name: string
          field_type: string
          id: string
          is_required: boolean
          is_sensitive: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_editable?: boolean
          default_viewable?: boolean
          entity_type: string
          field_label: string
          field_name: string
          field_type: string
          id?: string
          is_required?: boolean
          is_sensitive?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_editable?: boolean
          default_viewable?: boolean
          entity_type?: string
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          is_required?: boolean
          is_sensitive?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      field_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          created_at: string
          entity_field_id: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          entity_field_id: string
          id?: string
          role: string
          updated_at?: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          entity_field_id?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_permissions_entity_field_id_fkey"
            columns: ["entity_field_id"]
            isOneToOne: false
            referencedRelation: "entity_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      fwc_lookup_jobs: {
        Row: {
          batch_size: number
          completed_at: string | null
          created_at: string
          current_employer: string | null
          employer_ids: string[]
          estimated_duration: number | null
          id: string
          options: Json | null
          priority: string
          progress_completed: number
          progress_total: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          batch_size?: number
          completed_at?: string | null
          created_at?: string
          current_employer?: string | null
          employer_ids: string[]
          estimated_duration?: number | null
          id: string
          options?: Json | null
          priority?: string
          progress_completed?: number
          progress_total: number
          started_at?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          batch_size?: number
          completed_at?: string | null
          created_at?: string
          current_employer?: string | null
          employer_ids?: string[]
          estimated_duration?: number | null
          id?: string
          options?: Json | null
          priority?: string
          progress_completed?: number
          progress_total?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fwc_lookup_results: {
        Row: {
          created_at: string
          employer_id: string
          employer_name: string
          error: string | null
          fwc_results: Json | null
          id: string
          job_id: string
          processing_time: number
          selected_result: Json | null
          success: boolean
        }
        Insert: {
          created_at?: string
          employer_id: string
          employer_name: string
          error?: string | null
          fwc_results?: Json | null
          id?: string
          job_id: string
          processing_time: number
          selected_result?: Json | null
          success?: boolean
        }
        Update: {
          created_at?: string
          employer_id?: string
          employer_name?: string
          error?: string | null
          fwc_results?: Json | null
          id?: string
          job_id?: string
          processing_time?: number
          selected_result?: Json | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fwc_lookup_results_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "fwc_lookup_results_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fwc_lookup_results_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fwc_lookup_results_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fwc_lookup_results_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "fwc_lookup_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "fwc_lookup_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      help_documents: {
        Row: {
          category: string
          content: string
          created_at: string | null
          doc_id: string
          embedding: string | null
          id: string
          keywords: string[] | null
          pages: string[] | null
          related_docs: string[] | null
          roles: string[] | null
          screenshots: string[] | null
          steps: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          doc_id: string
          embedding?: string | null
          id?: string
          keywords?: string[] | null
          pages?: string[] | null
          related_docs?: string[] | null
          roles?: string[] | null
          screenshots?: string[] | null
          steps?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          doc_id?: string
          embedding?: string | null
          id?: string
          keywords?: string[] | null
          pages?: string[] | null
          related_docs?: string[] | null
          roles?: string[] | null
          screenshots?: string[] | null
          steps?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      help_interactions: {
        Row: {
          ai_provider: string | null
          answer: string
          confidence: number | null
          context: Json | null
          created_at: string | null
          feedback: string | null
          feedback_comment: string | null
          id: string
          question: string
          response_time_ms: number | null
          sources: Json | null
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          ai_provider?: string | null
          answer: string
          confidence?: number | null
          context?: Json | null
          created_at?: string | null
          feedback?: string | null
          feedback_comment?: string | null
          id?: string
          question: string
          response_time_ms?: number | null
          sources?: Json | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          ai_provider?: string | null
          answer?: string
          confidence?: number | null
          context?: Json | null
          created_at?: string | null
          feedback?: string | null
          feedback_comment?: string | null
          id?: string
          question?: string
          response_time_ms?: number | null
          sources?: Json | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sites: {
        Row: {
          created_at: string | null
          full_address: string | null
          geom: unknown | null
          id: string
          is_main_site: boolean | null
          latitude: number | null
          location: string
          longitude: number | null
          main_builder_id: string | null
          name: string
          patch_id: string | null
          project_id: string | null
          project_type: string | null
          shifts: Database["public"]["Enums"]["shift_type"][] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_address?: string | null
          geom?: unknown | null
          id?: string
          is_main_site?: boolean | null
          latitude?: number | null
          location: string
          longitude?: number | null
          main_builder_id?: string | null
          name: string
          patch_id?: string | null
          project_id?: string | null
          project_type?: string | null
          shifts?: Database["public"]["Enums"]["shift_type"][] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_address?: string | null
          geom?: unknown | null
          id?: string
          is_main_site?: boolean | null
          latitude?: number | null
          location?: string
          longitude?: number | null
          main_builder_id?: string | null
          name?: string
          patch_id?: string | null
          project_id?: string | null
          project_type?: string | null
          shifts?: Database["public"]["Enums"]["shift_type"][] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "job_sites_main_builder_id_fkey"
            columns: ["main_builder_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "job_sites_main_builder_id_fkey"
            columns: ["main_builder_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sites_main_builder_id_fkey"
            columns: ["main_builder_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sites_main_builder_id_fkey"
            columns: ["main_builder_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sites_main_builder_id_fkey"
            columns: ["main_builder_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "job_sites_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sites_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches_with_geojson"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_definitions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          source: string
          unit: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          label: string
          source?: string
          unit: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          source?: string
          unit?: string
        }
        Relationships: []
      }
      kpi_events: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string
          employer_id: string | null
          id: string
          job_site_id: string | null
          kpi_id: string
          occurred_at: string
          organiser_id: string | null
          value: number
          worker_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by: string
          employer_id?: string | null
          id?: string
          job_site_id?: string | null
          kpi_id: string
          occurred_at?: string
          organiser_id?: string | null
          value?: number
          worker_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string
          employer_id?: string | null
          id?: string
          job_site_id?: string | null
          kpi_id?: string
          occurred_at?: string
          organiser_id?: string | null
          value?: number
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_events_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "kpi_events_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_events_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_events_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_events_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "kpi_events_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_events_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "kpi_events_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "kpi_events_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_events_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_events_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "unallocated_workers_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_events_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_events_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_targets: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string
          due_date: string
          id: string
          job_site_id: string | null
          kpi_id: string
          organiser_id: string | null
          target_value: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by: string
          due_date: string
          id?: string
          job_site_id?: string | null
          kpi_id: string
          organiser_id?: string | null
          target_value: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string
          due_date?: string
          id?: string
          job_site_id?: string | null
          kpi_id?: string
          organiser_id?: string | null
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_targets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_targets_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_targets_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "kpi_targets_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "kpi_targets_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_targets_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_draft_organiser_links: {
        Row: {
          assigned_by: string | null
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          lead_user_id: string
          pending_user_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          lead_user_id: string
          pending_user_id: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          lead_user_id?: string
          pending_user_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_draft_organiser_links_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_draft_organiser_links_lead_user_id_fkey"
            columns: ["lead_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_draft_organiser_links_pending_user_id_fkey"
            columns: ["pending_user_id"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_organiser_patch_assignments: {
        Row: {
          effective_from: string
          effective_to: string | null
          id: string
          lead_organiser_id: string
          patch_id: string
        }
        Insert: {
          effective_from?: string
          effective_to?: string | null
          id?: string
          lead_organiser_id: string
          patch_id: string
        }
        Update: {
          effective_from?: string
          effective_to?: string | null
          id?: string
          lead_organiser_id?: string
          patch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_organiser_patch_assignments_lead_organiser_id_fkey"
            columns: ["lead_organiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_organiser_patch_assignments_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_organiser_patch_assignments_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches_with_geojson"
            referencedColumns: ["id"]
          },
        ]
      }
      mapping_sheet_scan_costs: {
        Row: {
          ai_provider: string
          cost_usd: number
          created_at: string
          id: string
          images_processed: number | null
          input_tokens: number | null
          model: string
          output_tokens: number | null
          processing_time_ms: number | null
          scan_id: string | null
          user_id: string | null
        }
        Insert: {
          ai_provider: string
          cost_usd: number
          created_at?: string
          id?: string
          images_processed?: number | null
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          processing_time_ms?: number | null
          scan_id?: string | null
          user_id?: string | null
        }
        Update: {
          ai_provider?: string
          cost_usd?: number
          created_at?: string
          id?: string
          images_processed?: number | null
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          processing_time_ms?: number | null
          scan_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mapping_sheet_scan_costs_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "mapping_sheet_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      mapping_sheet_scan_employer_matches: {
        Row: {
          alternate_matches: Json | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_employer_id: string | null
          create_new_employer: boolean | null
          created_at: string
          created_employer_id: string | null
          extracted_company_name: string
          extracted_eba_status: boolean | null
          extracted_role: string | null
          extracted_trade_type: string | null
          id: string
          match_confidence: number | null
          match_method: string | null
          matched_employer_id: string | null
          new_employer_data: Json | null
          scan_id: string | null
          user_confirmed: boolean | null
        }
        Insert: {
          alternate_matches?: Json | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_employer_id?: string | null
          create_new_employer?: boolean | null
          created_at?: string
          created_employer_id?: string | null
          extracted_company_name: string
          extracted_eba_status?: boolean | null
          extracted_role?: string | null
          extracted_trade_type?: string | null
          id?: string
          match_confidence?: number | null
          match_method?: string | null
          matched_employer_id?: string | null
          new_employer_data?: Json | null
          scan_id?: string | null
          user_confirmed?: boolean | null
        }
        Update: {
          alternate_matches?: Json | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_employer_id?: string | null
          create_new_employer?: boolean | null
          created_at?: string
          created_employer_id?: string | null
          extracted_company_name?: string
          extracted_eba_status?: boolean | null
          extracted_role?: string | null
          extracted_trade_type?: string | null
          id?: string
          match_confidence?: number | null
          match_method?: string | null
          matched_employer_id?: string | null
          new_employer_data?: Json | null
          scan_id?: string | null
          user_confirmed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_confirmed_employer_id_fkey"
            columns: ["confirmed_employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_confirmed_employer_id_fkey"
            columns: ["confirmed_employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_confirmed_employer_id_fkey"
            columns: ["confirmed_employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_confirmed_employer_id_fkey"
            columns: ["confirmed_employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_confirmed_employer_id_fkey"
            columns: ["confirmed_employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_created_employer_id_fkey"
            columns: ["created_employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_created_employer_id_fkey"
            columns: ["created_employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_created_employer_id_fkey"
            columns: ["created_employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_created_employer_id_fkey"
            columns: ["created_employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_created_employer_id_fkey"
            columns: ["created_employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_matched_employer_id_fkey"
            columns: ["matched_employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_matched_employer_id_fkey"
            columns: ["matched_employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_matched_employer_id_fkey"
            columns: ["matched_employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_matched_employer_id_fkey"
            columns: ["matched_employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_matched_employer_id_fkey"
            columns: ["matched_employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "mapping_sheet_scan_employer_matches_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "mapping_sheet_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      mapping_sheet_scans: {
        Row: {
          ai_provider: string | null
          batch_id: string | null
          confidence_scores: Json | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_project_id: string | null
          error_message: string | null
          extracted_data: Json | null
          extraction_attempted_at: string | null
          extraction_completed_at: string | null
          extraction_cost_usd: number | null
          file_name: string
          file_size_bytes: number | null
          file_url: string
          id: string
          intended_role_defaults: Json | null
          notes: string | null
          page_count: number | null
          project_id: string | null
          retry_count: number | null
          review_started_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          upload_mode: string | null
          uploaded_by: string | null
        }
        Insert: {
          ai_provider?: string | null
          batch_id?: string | null
          confidence_scores?: Json | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_project_id?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          extraction_attempted_at?: string | null
          extraction_completed_at?: string | null
          extraction_cost_usd?: number | null
          file_name: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          intended_role_defaults?: Json | null
          notes?: string | null
          page_count?: number | null
          project_id?: string | null
          retry_count?: number | null
          review_started_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          upload_mode?: string | null
          uploaded_by?: string | null
        }
        Update: {
          ai_provider?: string | null
          batch_id?: string | null
          confidence_scores?: Json | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_project_id?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          extraction_attempted_at?: string | null
          extraction_completed_at?: string | null
          extraction_cost_usd?: number | null
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          intended_role_defaults?: Json | null
          notes?: string | null
          page_count?: number | null
          project_id?: string | null
          retry_count?: number | null
          review_started_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          upload_mode?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mapping_sheet_scans_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_created_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_created_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_created_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_created_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_created_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_created_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_created_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_created_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_created_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapping_sheet_scans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      organiser_allocations: {
        Row: {
          allocated_by: string | null
          created_at: string
          end_date: string | null
          entity_id: string
          entity_type: string
          id: string
          is_active: boolean
          notes: string | null
          organiser_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          allocated_by?: string | null
          created_at?: string
          end_date?: string | null
          entity_id: string
          entity_type: string
          id?: string
          is_active?: boolean
          notes?: string | null
          organiser_id: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          allocated_by?: string | null
          created_at?: string
          end_date?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          organiser_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organiser_allocations_allocated_by_fkey"
            columns: ["allocated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_allocations_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organiser_patch_assignments: {
        Row: {
          effective_from: string
          effective_to: string | null
          id: string
          is_primary: boolean | null
          organiser_id: string
          patch_id: string
        }
        Insert: {
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_primary?: boolean | null
          organiser_id: string
          patch_id: string
        }
        Update: {
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_primary?: boolean | null
          organiser_id?: string
          patch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organiser_patch_assignments_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_patch_assignments_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_patch_assignments_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches_with_geojson"
            referencedColumns: ["id"]
          },
        ]
      }
      organisers: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      organising_universe_change_log: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          change_reason: string | null
          id: string
          new_value: string | null
          old_value: string | null
          project_id: string | null
          rule_applied: string | null
          was_manual_override: boolean | null
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          change_reason?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id?: string | null
          rule_applied?: string | null
          was_manual_override?: boolean | null
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          change_reason?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id?: string | null
          rule_applied?: string | null
          was_manual_override?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "organising_universe_change_log_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organising_universe_change_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organising_universe_change_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organising_universe_change_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "organising_universe_change_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "organising_universe_change_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organising_universe_change_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "organising_universe_change_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organising_universe_change_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organising_universe_change_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      overlay_images: {
        Row: {
          created_at: string
          created_by: string | null
          file_path: string
          id: string
          image_height: number | null
          image_width: number | null
          is_active: boolean
          notes: string | null
          target_corners: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_path: string
          id?: string
          image_height?: number | null
          image_width?: number | null
          is_active?: boolean
          notes?: string | null
          target_corners?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_path?: string
          id?: string
          image_height?: number | null
          image_width?: number | null
          is_active?: boolean
          notes?: string | null
          target_corners?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "overlay_images_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overlay_images_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patch_employers: {
        Row: {
          effective_from: string
          effective_to: string | null
          employer_id: string
          id: string
          patch_id: string
        }
        Insert: {
          effective_from?: string
          effective_to?: string | null
          employer_id: string
          id?: string
          patch_id: string
        }
        Update: {
          effective_from?: string
          effective_to?: string | null
          employer_id?: string
          id?: string
          patch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patch_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "patch_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patch_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patch_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patch_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "patch_employers_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patch_employers_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches_with_geojson"
            referencedColumns: ["id"]
          },
        ]
      }
      patch_job_sites: {
        Row: {
          effective_from: string
          effective_to: string | null
          id: string
          job_site_id: string
          patch_id: string
        }
        Insert: {
          effective_from?: string
          effective_to?: string | null
          id?: string
          job_site_id: string
          patch_id: string
        }
        Update: {
          effective_from?: string
          effective_to?: string | null
          id?: string
          job_site_id?: string
          patch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patch_job_sites_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patch_job_sites_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "patch_job_sites_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "patch_job_sites_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patch_job_sites_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches_with_geojson"
            referencedColumns: ["id"]
          },
        ]
      }
      patch_regions: {
        Row: {
          area_estimate: number | null
          code: string | null
          created_at: string
          created_by: string | null
          geojson: Json
          id: string
          name: string | null
          notes: string | null
          overlay_image_id: string | null
          source_file_path: string | null
          updated_at: string
          vertices_count: number | null
        }
        Insert: {
          area_estimate?: number | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          geojson: Json
          id?: string
          name?: string | null
          notes?: string | null
          overlay_image_id?: string | null
          source_file_path?: string | null
          updated_at?: string
          vertices_count?: number | null
        }
        Update: {
          area_estimate?: number | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          geojson?: Json
          id?: string
          name?: string | null
          notes?: string | null
          overlay_image_id?: string | null
          source_file_path?: string | null
          updated_at?: string
          vertices_count?: number | null
        }
        Relationships: []
      }
      patches: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          geom: unknown | null
          id: string
          name: string | null
          source_kml_path: string | null
          status: string
          sub_sectors: string[] | null
          type: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          geom?: unknown | null
          id?: string
          name?: string | null
          source_kml_path?: string | null
          status?: string
          sub_sectors?: string[] | null
          type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          geom?: unknown | null
          id?: string
          name?: string | null
          source_kml_path?: string | null
          status?: string
          sub_sectors?: string[] | null
          type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patches_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_employers: {
        Row: {
          bci_company_id: string | null
          company_name: string
          created_at: string
          created_by: string | null
          csv_role: string | null
          id: string
          import_notes: string | null
          import_status: string | null
          imported_employer_id: string | null
          inferred_trade_type: string | null
          our_role: string | null
          project_associations: Json | null
          raw: Json | null
          source: string | null
          updated_at: string | null
          user_confirmed_trade_type: string | null
        }
        Insert: {
          bci_company_id?: string | null
          company_name: string
          created_at?: string
          created_by?: string | null
          csv_role?: string | null
          id?: string
          import_notes?: string | null
          import_status?: string | null
          imported_employer_id?: string | null
          inferred_trade_type?: string | null
          our_role?: string | null
          project_associations?: Json | null
          raw?: Json | null
          source?: string | null
          updated_at?: string | null
          user_confirmed_trade_type?: string | null
        }
        Update: {
          bci_company_id?: string | null
          company_name?: string
          created_at?: string
          created_by?: string | null
          csv_role?: string | null
          id?: string
          import_notes?: string | null
          import_status?: string | null
          imported_employer_id?: string | null
          inferred_trade_type?: string | null
          our_role?: string | null
          project_associations?: Json | null
          raw?: Json | null
          source?: string | null
          updated_at?: string | null
          user_confirmed_trade_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_employers_imported_employer_id_fkey"
            columns: ["imported_employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "pending_employers_imported_employer_id_fkey"
            columns: ["imported_employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_employers_imported_employer_id_fkey"
            columns: ["imported_employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_employers_imported_employer_id_fkey"
            columns: ["imported_employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_employers_imported_employer_id_fkey"
            columns: ["imported_employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
        ]
      }
      pending_users: {
        Row: {
          assigned_patch_ids: string[]
          created_at: string
          created_by: string | null
          email: string
          full_name: string | null
          id: string
          invited_at: string | null
          notes: string | null
          role: string
          scoped_employers: string[] | null
          scoped_sites: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_patch_ids?: string[]
          created_at?: string
          created_by?: string | null
          email: string
          full_name?: string | null
          id?: string
          invited_at?: string | null
          notes?: string | null
          role?: string
          scoped_employers?: string[] | null
          scoped_sites?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_patch_ids?: string[]
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          invited_at?: string | null
          notes?: string | null
          role?: string
          scoped_employers?: string[] | null
          scoped_sites?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_audit_log: {
        Row: {
          access_method: string | null
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string | null
        }
        Insert: {
          access_method?: string | null
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Update: {
          access_method?: string | null
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          last_seen_projects_at: string | null
          phone: string | null
          role: string | null
          scoped_employers: string[] | null
          scoped_sites: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          last_seen_projects_at?: string | null
          phone?: string | null
          role?: string | null
          scoped_employers?: string[] | null
          scoped_sites?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_seen_projects_at?: string | null
          phone?: string | null
          role?: string | null
          scoped_employers?: string[] | null
          scoped_sites?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          actual_workers: number | null
          assignment_type: string
          confirmed_at: string | null
          confirmed_by: string | null
          contractor_role_type_id: string | null
          created_at: string | null
          employer_id: string
          end_date: string | null
          estimated_workers: number | null
          id: string
          is_primary_for_role: boolean | null
          match_confidence: number | null
          match_notes: string | null
          match_status: string | null
          matched_at: string | null
          notes: string | null
          project_id: string
          source: string | null
          start_date: string | null
          status: string | null
          trade_type_id: string | null
          updated_at: string | null
        }
        Insert: {
          actual_workers?: number | null
          assignment_type: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          contractor_role_type_id?: string | null
          created_at?: string | null
          employer_id: string
          end_date?: string | null
          estimated_workers?: number | null
          id?: string
          is_primary_for_role?: boolean | null
          match_confidence?: number | null
          match_notes?: string | null
          match_status?: string | null
          matched_at?: string | null
          notes?: string | null
          project_id: string
          source?: string | null
          start_date?: string | null
          status?: string | null
          trade_type_id?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_workers?: number | null
          assignment_type?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          contractor_role_type_id?: string | null
          created_at?: string | null
          employer_id?: string
          end_date?: string | null
          estimated_workers?: number | null
          id?: string
          is_primary_for_role?: boolean | null
          match_confidence?: number | null
          match_notes?: string | null
          match_status?: string | null
          matched_at?: string | null
          notes?: string | null
          project_id?: string
          source?: string | null
          start_date?: string | null
          status?: string | null
          trade_type_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_contractor_role_type_id_fkey"
            columns: ["contractor_role_type_id"]
            isOneToOne: false
            referencedRelation: "contractor_role_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "project_assignments_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_assignments_trade_type_id_fkey"
            columns: ["trade_type_id"]
            isOneToOne: false
            referencedRelation: "trade_types"
            referencedColumns: ["id"]
          },
        ]
      }
      project_builder_jv: {
        Row: {
          created_at: string
          id: string
          label: string | null
          project_id: string
          status: Database["public"]["Enums"]["jv_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["jv_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["jv_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_builder_jv_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_builder_jv_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_builder_jv_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_builder_jv_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_builder_jv_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_builder_jv_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_builder_jv_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_builder_jv_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_builder_jv_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      project_compliance: {
        Row: {
          abn_worker_check_conducted: boolean | null
          abn_worker_check_date: string | null
          created_at: string | null
          created_by: string | null
          delegate_elected: boolean | null
          delegate_elected_date: string | null
          delegate_identified: boolean | null
          delegate_site_access: string | null
          delegate_site_access_other: string | null
          delegate_worker_id: string | null
          effective_from: string | null
          effective_to: string | null
          hsr_chair_exists: boolean | null
          hsr_is_delegate: boolean | null
          hsr_worker_id: string | null
          id: string
          induction_attendees: string[] | null
          inductions_attended: boolean | null
          is_current: boolean | null
          last_induction_date: string | null
          next_report_date: string | null
          project_id: string
          reporting_frequency: string | null
          updated_at: string | null
          updated_by: string | null
          version: number | null
        }
        Insert: {
          abn_worker_check_conducted?: boolean | null
          abn_worker_check_date?: string | null
          created_at?: string | null
          created_by?: string | null
          delegate_elected?: boolean | null
          delegate_elected_date?: string | null
          delegate_identified?: boolean | null
          delegate_site_access?: string | null
          delegate_site_access_other?: string | null
          delegate_worker_id?: string | null
          effective_from?: string | null
          effective_to?: string | null
          hsr_chair_exists?: boolean | null
          hsr_is_delegate?: boolean | null
          hsr_worker_id?: string | null
          id?: string
          induction_attendees?: string[] | null
          inductions_attended?: boolean | null
          is_current?: boolean | null
          last_induction_date?: string | null
          next_report_date?: string | null
          project_id: string
          reporting_frequency?: string | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          abn_worker_check_conducted?: boolean | null
          abn_worker_check_date?: string | null
          created_at?: string | null
          created_by?: string | null
          delegate_elected?: boolean | null
          delegate_elected_date?: string | null
          delegate_identified?: boolean | null
          delegate_site_access?: string | null
          delegate_site_access_other?: string | null
          delegate_worker_id?: string | null
          effective_from?: string | null
          effective_to?: string | null
          hsr_chair_exists?: boolean | null
          hsr_is_delegate?: boolean | null
          hsr_worker_id?: string | null
          id?: string
          induction_attendees?: string[] | null
          inductions_attended?: boolean | null
          is_current?: boolean | null
          last_induction_date?: string | null
          next_report_date?: string | null
          project_id?: string
          reporting_frequency?: string | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_compliance_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_delegate_worker_id_fkey"
            columns: ["delegate_worker_id"]
            isOneToOne: false
            referencedRelation: "unallocated_workers_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_delegate_worker_id_fkey"
            columns: ["delegate_worker_id"]
            isOneToOne: false
            referencedRelation: "worker_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_delegate_worker_id_fkey"
            columns: ["delegate_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_hsr_worker_id_fkey"
            columns: ["hsr_worker_id"]
            isOneToOne: false
            referencedRelation: "unallocated_workers_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_hsr_worker_id_fkey"
            columns: ["hsr_worker_id"]
            isOneToOne: false
            referencedRelation: "worker_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_hsr_worker_id_fkey"
            columns: ["hsr_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_compliance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_compliance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_compliance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_compliance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_compliance_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_contractor_trades: {
        Row: {
          assignment_id: string | null
          assignment_notes: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          eba_signatory: Database["public"]["Enums"]["eba_status_type"]
          employer_id: string
          end_date: string | null
          estimated_project_workforce: number | null
          id: string
          match_confidence: number | null
          match_notes: string | null
          match_status: string | null
          matched_at: string | null
          project_id: string
          source: string | null
          stage: Database["public"]["Enums"]["trade_stage"] | null
          start_date: string | null
          trade_type: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          assignment_notes?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          eba_signatory?: Database["public"]["Enums"]["eba_status_type"]
          employer_id: string
          end_date?: string | null
          estimated_project_workforce?: number | null
          id?: string
          match_confidence?: number | null
          match_notes?: string | null
          match_status?: string | null
          matched_at?: string | null
          project_id: string
          source?: string | null
          stage?: Database["public"]["Enums"]["trade_stage"] | null
          start_date?: string | null
          trade_type: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          assignment_notes?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          eba_signatory?: Database["public"]["Enums"]["eba_status_type"]
          employer_id?: string
          end_date?: string | null
          estimated_project_workforce?: number | null
          id?: string
          match_confidence?: number | null
          match_notes?: string | null
          match_status?: string | null
          matched_at?: string | null
          project_id?: string
          source?: string | null
          stage?: Database["public"]["Enums"]["trade_stage"] | null
          start_date?: string | null
          trade_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "project_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      project_eba_details: {
        Row: {
          bargaining_status: string | null
          created_at: string
          eba_title: string | null
          id: string
          project_id: string
          registration_number: string | null
          status: Database["public"]["Enums"]["eba_status"]
          updated_at: string
        }
        Insert: {
          bargaining_status?: string | null
          created_at?: string
          eba_title?: string | null
          id?: string
          project_id: string
          registration_number?: string | null
          status?: Database["public"]["Enums"]["eba_status"]
          updated_at?: string
        }
        Update: {
          bargaining_status?: string | null
          created_at?: string
          eba_title?: string | null
          id?: string
          project_id?: string
          registration_number?: string | null
          status?: Database["public"]["Enums"]["eba_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_eba_details_project"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_eba_details_project"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_eba_details_project"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_project_eba_details_project"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_project_eba_details_project"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_eba_details_project"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_project_eba_details_project"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_eba_details_project"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_eba_details_project"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      project_employer_roles: {
        Row: {
          created_at: string
          employer_id: string
          end_date: string | null
          id: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employer_id: string
          end_date?: string | null
          id?: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          start_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employer_id?: string
          end_date?: string | null
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_employer_roles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "project_employer_roles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      project_organisers: {
        Row: {
          created_at: string
          id: string
          organiser_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organiser_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organiser_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_organisers_organiser"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_organisers_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_organisers_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_organisers_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_project_organisers_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_project_organisers_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_organisers_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_project_organisers_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_organisers_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_organisers_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      project_trade_availability: {
        Row: {
          created_at: string
          id: string
          project_id: string
          stage: Database["public"]["Enums"]["trade_stage"]
          status: string
          trade_type: Database["public"]["Enums"]["trade_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          stage: Database["public"]["Enums"]["trade_stage"]
          status?: string
          trade_type: Database["public"]["Enums"]["trade_type"]
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          stage?: Database["public"]["Enums"]["trade_stage"]
          status?: string
          trade_type?: Database["public"]["Enums"]["trade_type"]
        }
        Relationships: [
          {
            foreignKeyName: "project_trade_availability_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_trade_availability_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_trade_availability_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_trade_availability_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_trade_availability_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_trade_availability_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_trade_availability_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_trade_availability_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_trade_availability_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      projects: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          bci_project_id: string | null
          builder_id: string | null
          created_at: string
          created_by: string | null
          federal_funding: number
          funding_type_primary: string | null
          health_safety_committee_goal: number | null
          id: string
          last_update_date: string | null
          main_job_site_id: string | null
          name: string
          organising_universe: Database["public"]["Enums"]["project_organising_universe"]
          organising_universe_auto_assigned: boolean | null
          organising_universe_change_reason: string | null
          organising_universe_last_auto_update: string | null
          organising_universe_manual_override: boolean | null
          owner_type_level_1: string | null
          project_stage: string | null
          project_status: string | null
          project_type: Database["public"]["Enums"]["project_type"] | null
          proposed_finish_date: string | null
          proposed_start_date: string | null
          rejection_reason: string | null
          roe_email: string | null
          stage_class: Database["public"]["Enums"]["project_stage_class"]
          state_funding: number
          tier: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bci_project_id?: string | null
          builder_id?: string | null
          created_at?: string
          created_by?: string | null
          federal_funding?: number
          funding_type_primary?: string | null
          health_safety_committee_goal?: number | null
          id?: string
          last_update_date?: string | null
          main_job_site_id?: string | null
          name: string
          organising_universe?: Database["public"]["Enums"]["project_organising_universe"]
          organising_universe_auto_assigned?: boolean | null
          organising_universe_change_reason?: string | null
          organising_universe_last_auto_update?: string | null
          organising_universe_manual_override?: boolean | null
          owner_type_level_1?: string | null
          project_stage?: string | null
          project_status?: string | null
          project_type?: Database["public"]["Enums"]["project_type"] | null
          proposed_finish_date?: string | null
          proposed_start_date?: string | null
          rejection_reason?: string | null
          roe_email?: string | null
          stage_class?: Database["public"]["Enums"]["project_stage_class"]
          state_funding?: number
          tier?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bci_project_id?: string | null
          builder_id?: string | null
          created_at?: string
          created_by?: string | null
          federal_funding?: number
          funding_type_primary?: string | null
          health_safety_committee_goal?: number | null
          id?: string
          last_update_date?: string | null
          main_job_site_id?: string | null
          name?: string
          organising_universe?: Database["public"]["Enums"]["project_organising_universe"]
          organising_universe_auto_assigned?: boolean | null
          organising_universe_change_reason?: string | null
          organising_universe_last_auto_update?: string | null
          organising_universe_manual_override?: boolean | null
          owner_type_level_1?: string | null
          project_stage?: string | null
          project_status?: string | null
          project_type?: Database["public"]["Enums"]["project_type"] | null
          proposed_finish_date?: string | null
          proposed_start_date?: string | null
          rejection_reason?: string | null
          roe_email?: string | null
          stage_class?: Database["public"]["Enums"]["project_stage_class"]
          state_funding?: number
          tier?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_builder"
            columns: ["builder_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "fk_projects_builder"
            columns: ["builder_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_projects_builder"
            columns: ["builder_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_projects_builder"
            columns: ["builder_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_projects_builder"
            columns: ["builder_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "fk_projects_main_job_site"
            columns: ["main_job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_projects_main_job_site"
            columns: ["main_job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "fk_projects_main_job_site"
            columns: ["main_job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
        ]
      }
      projects_organising_universe_backup: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          organising_universe:
            | Database["public"]["Enums"]["project_organising_universe"]
            | null
          tier: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          organising_universe?:
            | Database["public"]["Enums"]["project_organising_universe"]
            | null
          tier?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          organising_universe?:
            | Database["public"]["Enums"]["project_organising_universe"]
            | null
          tier?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: []
      }
      role_hierarchy: {
        Row: {
          assigned_by: string | null
          child_user_id: string
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          parent_user_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          child_user_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          parent_user_id: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          child_user_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          parent_user_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_hierarchy_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_hierarchy_child_user_id_fkey"
            columns: ["child_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_hierarchy_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_job_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          job_id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          job_id: string
          payload?: Json | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          job_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "scraper_job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scraper_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          job_type: Database["public"]["Enums"]["scraper_job_type"]
          last_error: string | null
          lock_token: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          priority: number
          progress_completed: number
          progress_total: number
          run_at: string
          status: Database["public"]["Enums"]["scraper_job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_type: Database["public"]["Enums"]["scraper_job_type"]
          last_error?: string | null
          lock_token?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload: Json
          priority?: number
          progress_completed?: number
          progress_total?: number
          run_at?: string
          status?: Database["public"]["Enums"]["scraper_job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["scraper_job_type"]
          last_error?: string | null
          lock_token?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          progress_completed?: number
          progress_total?: number
          run_at?: string
          status?: Database["public"]["Enums"]["scraper_job_status"]
          updated_at?: string
        }
        Relationships: []
      }
      secure_access_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          resource_id: string
          resource_type: string
          token: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          resource_id: string
          resource_type: string
          token: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          resource_id?: string
          resource_type?: string
          token?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: []
      }
      site_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          job_site_id: string
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["site_contact_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          job_site_id: string
          name: string
          phone?: string | null
          role: Database["public"]["Enums"]["site_contact_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          job_site_id?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["site_contact_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_site_contacts_job_site"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_site_contacts_job_site"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "fk_site_contacts_job_site"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
        ]
      }
      site_contractor_trades: {
        Row: {
          created_at: string
          eba_signatory: Database["public"]["Enums"]["eba_status_type"] | null
          eba_status: boolean | null
          employer_id: string | null
          end_date: string | null
          id: string
          job_site_id: string | null
          notes: string | null
          start_date: string | null
          trade_type: Database["public"]["Enums"]["trade_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          eba_signatory?: Database["public"]["Enums"]["eba_status_type"] | null
          eba_status?: boolean | null
          employer_id?: string | null
          end_date?: string | null
          id?: string
          job_site_id?: string | null
          notes?: string | null
          start_date?: string | null
          trade_type: Database["public"]["Enums"]["trade_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          eba_signatory?: Database["public"]["Enums"]["eba_status_type"] | null
          eba_status?: boolean | null
          employer_id?: string | null
          end_date?: string | null
          id?: string
          job_site_id?: string | null
          notes?: string | null
          start_date?: string | null
          trade_type?: Database["public"]["Enums"]["trade_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "site_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "site_contractor_trades_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_contractor_trades_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "site_contractor_trades_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
        ]
      }
      site_employers: {
        Row: {
          created_at: string | null
          employer_id: string | null
          id: string
          job_site_id: string | null
        }
        Insert: {
          created_at?: string | null
          employer_id?: string | null
          id?: string
          job_site_id?: string | null
        }
        Update: {
          created_at?: string | null
          employer_id?: string | null
          id?: string
          job_site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "site_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "site_employers_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_employers_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "site_employers_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
        ]
      }
      site_visit: {
        Row: {
          created_at: string
          employer_id: string
          estimated_workers_count: number | null
          id: string
          job_site_id: string
          objective: string | null
          outcomes_locked: boolean
          scheduled_at: string | null
          sv_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employer_id: string
          estimated_workers_count?: number | null
          id?: string
          job_site_id: string
          objective?: string | null
          outcomes_locked?: boolean
          scheduled_at?: string | null
          sv_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employer_id?: string
          estimated_workers_count?: number | null
          id?: string
          job_site_id?: string
          objective?: string | null
          outcomes_locked?: boolean
          scheduled_at?: string | null
          sv_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_visit_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "site_visit_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "site_visit_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visit_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "site_visit_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
        ]
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
      trade_types: {
        Row: {
          category: string
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      training_participation: {
        Row: {
          created_at: string | null
          date: string
          id: string
          location: string | null
          status: Database["public"]["Enums"]["training_status"] | null
          training_type: string
          updated_at: string | null
          worker_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          location?: string | null
          status?: Database["public"]["Enums"]["training_status"] | null
          training_type: string
          updated_at?: string | null
          worker_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          location?: string | null
          status?: Database["public"]["Enums"]["training_status"] | null
          training_type?: string
          updated_at?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_participation_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "unallocated_workers_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_participation_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_participation_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      union_activities: {
        Row: {
          activity_call_to_action: string | null
          activity_type: Database["public"]["Enums"]["activity_type"]
          activity_ui_type: string | null
          assignment_metadata: Json | null
          campaign_id: string | null
          created_at: string | null
          custom_activity_type: string | null
          date: string
          id: string
          job_site_id: string | null
          notes: string | null
          template_id: string | null
          topic: string | null
          total_delegates: number | null
          total_participants: number | null
          updated_at: string | null
        }
        Insert: {
          activity_call_to_action?: string | null
          activity_type: Database["public"]["Enums"]["activity_type"]
          activity_ui_type?: string | null
          assignment_metadata?: Json | null
          campaign_id?: string | null
          created_at?: string | null
          custom_activity_type?: string | null
          date: string
          id?: string
          job_site_id?: string | null
          notes?: string | null
          template_id?: string | null
          topic?: string | null
          total_delegates?: number | null
          total_participants?: number | null
          updated_at?: string | null
        }
        Update: {
          activity_call_to_action?: string | null
          activity_type?: Database["public"]["Enums"]["activity_type"]
          activity_ui_type?: string | null
          assignment_metadata?: Json | null
          campaign_id?: string | null
          created_at?: string | null
          custom_activity_type?: string | null
          date?: string
          id?: string
          job_site_id?: string | null
          notes?: string | null
          template_id?: string | null
          topic?: string | null
          total_delegates?: number | null
          total_participants?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_activities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_activities_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_activities_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "union_activities_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
        ]
      }
      union_activity_scopes: {
        Row: {
          activity_id: string
          created_at: string
          employer_id: string | null
          id: string
          job_site_id: string | null
          project_id: string | null
        }
        Insert: {
          activity_id: string
          created_at?: string
          employer_id?: string | null
          id?: string
          job_site_id?: string | null
          project_id?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string
          employer_id?: string | null
          id?: string
          job_site_id?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_activity_scopes_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "union_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_activity_scopes_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "union_activity_scopes_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_activity_scopes_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_activity_scopes_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_activity_scopes_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "union_activity_scopes_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_activity_scopes_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "union_activity_scopes_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "union_activity_scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_activity_scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_activity_scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "union_activity_scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "union_activity_scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_activity_scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "union_activity_scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_activity_scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_activity_scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      union_roles: {
        Row: {
          cfmeu_registration_data: Json | null
          cfmeu_registration_submitted_at: string | null
          created_at: string | null
          date_elected: string | null
          elected_by: string | null
          end_date: string | null
          experience_level: string | null
          gets_paid_time: boolean | null
          id: string
          is_senior: boolean | null
          job_site_id: string | null
          name: Database["public"]["Enums"]["union_role_type"]
          notes: string | null
          ohs_refresher_training_date: string | null
          ohs_training_date: string | null
          rating: string | null
          start_date: string
          updated_at: string | null
          worker_id: string | null
        }
        Insert: {
          cfmeu_registration_data?: Json | null
          cfmeu_registration_submitted_at?: string | null
          created_at?: string | null
          date_elected?: string | null
          elected_by?: string | null
          end_date?: string | null
          experience_level?: string | null
          gets_paid_time?: boolean | null
          id?: string
          is_senior?: boolean | null
          job_site_id?: string | null
          name: Database["public"]["Enums"]["union_role_type"]
          notes?: string | null
          ohs_refresher_training_date?: string | null
          ohs_training_date?: string | null
          rating?: string | null
          start_date: string
          updated_at?: string | null
          worker_id?: string | null
        }
        Update: {
          cfmeu_registration_data?: Json | null
          cfmeu_registration_submitted_at?: string | null
          created_at?: string | null
          date_elected?: string | null
          elected_by?: string | null
          end_date?: string | null
          experience_level?: string | null
          gets_paid_time?: boolean | null
          id?: string
          is_senior?: boolean | null
          job_site_id?: string | null
          name?: Database["public"]["Enums"]["union_role_type"]
          notes?: string | null
          ohs_refresher_training_date?: string | null
          ohs_training_date?: string | null
          rating?: string | null
          start_date?: string
          updated_at?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_roles_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_roles_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "union_roles_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "union_roles_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "unallocated_workers_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_roles_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_roles_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_external_credentials: {
        Row: {
          created_at: string
          provider: string
          secret_encrypted: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          provider: string
          secret_encrypted: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          provider?: string
          secret_encrypted?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_external_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          notes: string | null
          role: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          role: string
          start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          role?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whs_assessment: {
        Row: {
          created_at: string
          id: string
          rating_code: string
          site_visit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating_code: string
          site_visit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          rating_code?: string
          site_visit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whs_assessment_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whs_assessment_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["id"]
          },
        ]
      }
      whs_breach: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          rating_code: string
          title: string
          updated_at: string
          whs_assessment_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          rating_code: string
          title: string
          updated_at?: string
          whs_assessment_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          rating_code?: string
          title?: string
          updated_at?: string
          whs_assessment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whs_breach_whs_assessment_id_fkey"
            columns: ["whs_assessment_id"]
            isOneToOne: false
            referencedRelation: "whs_assessment"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_activity_ratings: {
        Row: {
          activity_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          rated_by: string | null
          rating_type: Database["public"]["Enums"]["rating_type"]
          rating_value: number | null
          worker_id: string | null
        }
        Insert: {
          activity_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          rated_by?: string | null
          rating_type: Database["public"]["Enums"]["rating_type"]
          rating_value?: number | null
          worker_id?: string | null
        }
        Update: {
          activity_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          rated_by?: string | null
          rating_type?: Database["public"]["Enums"]["rating_type"]
          rating_value?: number | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_activity_ratings_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "union_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_activity_ratings_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "unallocated_workers_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_activity_ratings_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_activity_ratings_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_delegate_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          delegate_id: string
          end_date: string | null
          id: string
          is_active: boolean
          notes: string | null
          start_date: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          delegate_id: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          start_date?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          delegate_id?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          start_date?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_delegate_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_delegate_assignments_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_delegate_assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "unallocated_workers_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_delegate_assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_delegate_assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_memberships: {
        Row: {
          arrears_amount: number | null
          created_at: string
          dd_mandate_id: string | null
          dd_status: Database["public"]["Enums"]["dd_status_type"]
          last_payment_at: string | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          updated_at: string
          worker_id: string
        }
        Insert: {
          arrears_amount?: number | null
          created_at?: string
          dd_mandate_id?: string | null
          dd_status?: Database["public"]["Enums"]["dd_status_type"]
          last_payment_at?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
          worker_id: string
        }
        Update: {
          arrears_amount?: number | null
          created_at?: string
          dd_mandate_id?: string | null
          dd_status?: Database["public"]["Enums"]["dd_status_type"]
          last_payment_at?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_memberships_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: true
            referencedRelation: "unallocated_workers_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_memberships_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: true
            referencedRelation: "worker_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_memberships_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: true
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_placements: {
        Row: {
          created_at: string | null
          employer_id: string | null
          employment_status: Database["public"]["Enums"]["employment_status"]
          end_date: string | null
          id: string
          job_site_id: string | null
          job_title: string | null
          shift: Database["public"]["Enums"]["shift_type"] | null
          start_date: string
          updated_at: string | null
          worker_id: string | null
        }
        Insert: {
          created_at?: string | null
          employer_id?: string | null
          employment_status: Database["public"]["Enums"]["employment_status"]
          end_date?: string | null
          id?: string
          job_site_id?: string | null
          job_title?: string | null
          shift?: Database["public"]["Enums"]["shift_type"] | null
          start_date: string
          updated_at?: string | null
          worker_id?: string | null
        }
        Update: {
          created_at?: string | null
          employer_id?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          end_date?: string | null
          id?: string
          job_site_id?: string | null
          job_title?: string | null
          shift?: Database["public"]["Enums"]["shift_type"] | null
          start_date?: string
          updated_at?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "worker_placements_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "worker_placements_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "worker_placements_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "unallocated_workers_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          first_name: string
          gender: string | null
          home_address_line_1: string | null
          home_address_line_2: string | null
          home_address_postcode: string | null
          home_address_state: string | null
          home_address_suburb: string | null
          home_phone: string | null
          id: string
          incolink_member_id: string | null
          inductions: string[] | null
          informal_network_tags: string[] | null
          last_incolink_payment: string | null
          member_number: string | null
          mobile_phone: string | null
          nickname: string | null
          organiser_id: string | null
          other_industry_bodies: string[] | null
          other_name: string | null
          qualifications: string[] | null
          redundancy_fund: string | null
          superannuation_fund: string | null
          surname: string
          union_membership_status:
            | Database["public"]["Enums"]["union_membership_status"]
            | null
          updated_at: string | null
          work_phone: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          gender?: string | null
          home_address_line_1?: string | null
          home_address_line_2?: string | null
          home_address_postcode?: string | null
          home_address_state?: string | null
          home_address_suburb?: string | null
          home_phone?: string | null
          id?: string
          incolink_member_id?: string | null
          inductions?: string[] | null
          informal_network_tags?: string[] | null
          last_incolink_payment?: string | null
          member_number?: string | null
          mobile_phone?: string | null
          nickname?: string | null
          organiser_id?: string | null
          other_industry_bodies?: string[] | null
          other_name?: string | null
          qualifications?: string[] | null
          redundancy_fund?: string | null
          superannuation_fund?: string | null
          surname: string
          union_membership_status?:
            | Database["public"]["Enums"]["union_membership_status"]
            | null
          updated_at?: string | null
          work_phone?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          gender?: string | null
          home_address_line_1?: string | null
          home_address_line_2?: string | null
          home_address_postcode?: string | null
          home_address_state?: string | null
          home_address_suburb?: string | null
          home_phone?: string | null
          id?: string
          incolink_member_id?: string | null
          inductions?: string[] | null
          informal_network_tags?: string[] | null
          last_incolink_payment?: string | null
          member_number?: string | null
          mobile_phone?: string | null
          nickname?: string | null
          organiser_id?: string | null
          other_industry_bodies?: string[] | null
          other_name?: string | null
          qualifications?: string[] | null
          redundancy_fund?: string | null
          superannuation_fund?: string | null
          surname?: string
          union_membership_status?:
            | Database["public"]["Enums"]["union_membership_status"]
            | null
          updated_at?: string | null
          work_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dashboard_project_metrics: {
        Row: {
          avg_estimated_workers: number | null
          company_delegates: number | null
          concreting_employers: number | null
          crane_employers: number | null
          demolition_employers: number | null
          eba_builder_percentage: number | null
          eba_builders: number | null
          eba_employer_percentage: number | null
          eba_employers: number | null
          formwork_employers: number | null
          has_company_delegates: boolean | null
          has_hsr_chair_delegate: boolean | null
          has_hsrs: boolean | null
          has_site_delegates: boolean | null
          health_safety_committee_goal: number | null
          hs_committee_members: number | null
          hs_committee_status: string | null
          hsrs: number | null
          id: string | null
          name: string | null
          organising_universe:
            | Database["public"]["Enums"]["project_organising_universe"]
            | null
          piling_employers: number | null
          scaffold_employers: number | null
          site_delegates: number | null
          stage_class: Database["public"]["Enums"]["project_stage_class"] | null
          total_builders: number | null
          total_employers: number | null
          total_members: number | null
          total_workers: number | null
          value: number | null
        }
        Relationships: []
      }
      emergency_rollback_info: {
        Row: {
          info_type: string | null
          project_count: number | null
          universe_values: string | null
        }
        Relationships: []
      }
      alias_conflict_backlog: {
        Row: {
          alias_id: string | null
          employer_id: string | null
          proposed_name: string | null
          current_canonical_name: string | null
          priority: number | null
          is_authoritative: boolean | null
          source_system: string | null
          collected_at: string | null
          conflict_warnings: Json | null
          conflict_count: number | null
          age_bucket: string | null
          hours_in_queue: number | null
        }
        Relationships: []
      }
      alias_metrics_daily: {
        Row: {
          metric_date: string | null
          aliases_created: number | null
          authoritative_created: number | null
          employers_affected: number | null
          source_systems_active: number | null
          by_source_system: Json | null
        }
        Relationships: []
      }
      alias_metrics_summary: {
        Row: {
          total_aliases: number | null
          employers_with_aliases: number | null
          authoritative_aliases: number | null
          bci_aliases: number | null
          incolink_aliases: number | null
          fwc_aliases: number | null
          eba_aliases: number | null
          manual_aliases: number | null
          pending_import_aliases: number | null
          legacy_aliases: number | null
          aliases_last_7_days: number | null
          aliases_last_30_days: number | null
          total_promotions: number | null
          total_rejections: number | null
          total_deferrals: number | null
          decisions_last_7_days: number | null
          decisions_last_30_days: number | null
          earliest_alias_created: string | null
          latest_alias_created: string | null
          computed_at: string | null
        }
        Relationships: []
      }
      alias_source_system_stats: {
        Row: {
          source_system: string | null
          total_aliases: number | null
          authoritative_count: number | null
          employer_count: number | null
          earliest_collected: string | null
          latest_collected: string | null
          new_last_7_days: number | null
          new_last_30_days: number | null
          avg_aliases_per_employer: number | null
        }
        Relationships: []
      }
      canonical_review_metrics: {
        Row: {
          pending_reviews: number | null
          high_priority_reviews: number | null
          medium_priority_reviews: number | null
          previously_deferred: number | null
          promotions_last_7_days: number | null
          rejections_last_7_days: number | null
          deferrals_last_7_days: number | null
          median_resolution_hours: number | null
          computed_at: string | null
        }
        Relationships: []
      }
      employer_alias_coverage: {
        Row: {
          total_employers: number | null
          employers_with_aliases: number | null
          coverage_percentage: number | null
          employers_with_authoritative: number | null
          employers_with_external_id_no_aliases: number | null
          computed_at: string | null
        }
        Relationships: []
      }
      employer_alias_stats: {
        Row: {
          authoritative_aliases: number | null
          earliest_alias_collected: string | null
          employer_id: string | null
          employer_name: string | null
          latest_alias_collected: string | null
          source_systems: Json | null
          total_aliases: number | null
        }
        Relationships: []
      }
      employer_analytics: {
        Row: {
          current_worker_count: number | null
          employer_id: string | null
          employer_name: string | null
          estimated_density_percent: number | null
          estimated_worker_count: number | null
          member_count: number | null
          member_density_percent: number | null
          workers_with_job_site: number | null
          workers_without_job_site: number | null
        }
        Relationships: []
      }
      canonical_promotion_queue: {
        Row: {
          alias_created_at: string
          alias_id: string | null
          alias_normalized: string | null
          alias_notes: string | null
          bci_company_id: string | null
          collected_at: string | null
          collected_by: string | null
          conflict_warnings: Json | null
          current_canonical_name: string | null
          employer_id: string | null
          incolink_id: string | null
          is_authoritative: boolean | null
          previous_decision: string | null
          priority: number | null
          proposed_name: string | null
          source_identifier: string | null
          source_system: string | null
          total_aliases: number | null
        }
        Relationships: []
      }
      employer_list_view: {
        Row: {
          abn: string | null
          company_eba_record: Json | null
          computed_at: string | null
          eba_category: string | null
          eba_recency_score: number | null
          email: string | null
          employer_type: Database["public"]["Enums"]["employer_type"] | null
          estimated_worker_count: number | null
          id: string | null
          is_engaged: boolean | null
          name: string | null
          phone: string | null
          project_assignment_count: number | null
          project_assignment_ids: string[] | null
          search_text: string | null
          website: string | null
          worker_placement_count: number | null
          worker_placement_ids: string[] | null
        }
        Relationships: []
      }
      employer_project_trades: {
        Row: {
          all_stages: string[] | null
          all_trade_types: string[] | null
          employer_id: string | null
          employer_name: string | null
          latest_assignment: string | null
          project_id: string | null
          project_name: string | null
          total_assignments: number | null
          total_estimated_workforce: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "project_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractor_trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      employers_with_eba: {
        Row: {
          abn: string | null
          address_line_1: string | null
          address_line_2: string | null
          contact_notes: string | null
          created_at: string | null
          eba_category: string | null
          email: string | null
          employer_type: Database["public"]["Enums"]["employer_type"] | null
          enterprise_agreement_status: boolean | null
          eba_status_source: Database["public"]["Enums"]["eba_status_source"] | null
          eba_status_updated_at: string | null
          eba_status_notes: string | null
          estimated_worker_count: number | null
          id: string | null
          name: string | null
          parent_employer_id: string | null
          phone: string | null
          postcode: string | null
          primary_contact_name: string | null
          state: string | null
          suburb: string | null
          updated_at: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employers_parent_employer_id_fkey"
            columns: ["parent_employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "employers_parent_employer_id_fkey"
            columns: ["parent_employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employers_parent_employer_id_fkey"
            columns: ["parent_employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employers_parent_employer_id_fkey"
            columns: ["parent_employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employers_parent_employer_id_fkey"
            columns: ["parent_employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown | null
          f_table_catalog: unknown | null
          f_table_name: unknown | null
          f_table_schema: unknown | null
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown | null
          f_table_catalog: string | null
          f_table_name: unknown | null
          f_table_schema: unknown | null
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown | null
          f_table_catalog?: string | null
          f_table_name?: unknown | null
          f_table_schema?: unknown | null
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown | null
          f_table_catalog?: string | null
          f_table_name?: unknown | null
          f_table_schema?: unknown | null
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      help_common_questions: {
        Row: {
          ask_count: number | null
          avg_confidence: number | null
          negative_count: number | null
          normalized_question: string | null
          positive_count: number | null
          positive_rate: number | null
        }
        Relationships: []
      }
      help_low_confidence_questions: {
        Row: {
          answer: string | null
          confidence: number | null
          context: Json | null
          created_at: string | null
          question: string | null
          sources: Json | null
        }
        Insert: {
          answer?: string | null
          confidence?: number | null
          context?: Json | null
          created_at?: string | null
          question?: string | null
          sources?: Json | null
        }
        Update: {
          answer?: string | null
          confidence?: number | null
          context?: Json | null
          created_at?: string | null
          question?: string | null
          sources?: Json | null
        }
        Relationships: []
      }
      organising_universe_impact_analysis: {
        Row: {
          builder_has_eba: boolean | null
          builder_name: string | null
          calculated_universe: string | null
          change_type: string | null
          current_universe:
            | Database["public"]["Enums"]["project_organising_universe"]
            | null
          has_patch_assignment: boolean | null
          id: string | null
          name: string | null
          organising_universe_manual_override: boolean | null
          tier: string | null
          value: number | null
          would_be_updated: boolean | null
        }
        Insert: {
          builder_has_eba?: never
          builder_name?: never
          calculated_universe?: never
          change_type?: never
          current_universe?:
            | Database["public"]["Enums"]["project_organising_universe"]
            | null
          has_patch_assignment?: never
          id?: string | null
          name?: string | null
          organising_universe_manual_override?: boolean | null
          tier?: string | null
          value?: number | null
          would_be_updated?: never
        }
        Update: {
          builder_has_eba?: never
          builder_name?: never
          calculated_universe?: never
          change_type?: never
          current_universe?:
            | Database["public"]["Enums"]["project_organising_universe"]
            | null
          has_patch_assignment?: never
          id?: string | null
          name?: string | null
          organising_universe_manual_override?: boolean | null
          tier?: string | null
          value?: number | null
          would_be_updated?: never
        }
        Relationships: []
      }
      patch_project_mapping_view: {
        Row: {
          effective_from: string | null
          effective_to: string | null
          job_site_id: string | null
          job_site_name: string | null
          patch_id: string | null
          patch_name: string | null
          project_id: string | null
          project_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "patch_job_sites_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patch_job_sites_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches_with_geojson"
            referencedColumns: ["id"]
          },
        ]
      }
      patches_with_geojson: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string | null
          geom: unknown | null
          geom_geojson: Json | null
          id: string | null
          name: string | null
          source_kml_path: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          geom?: unknown | null
          geom_geojson?: never
          id?: string | null
          name?: string | null
          source_kml_path?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          geom?: unknown | null
          geom_geojson?: never
          id?: string | null
          name?: string | null
          source_kml_path?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patches_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_all_builders: {
        Row: {
          primary_builder_id: string | null
          primary_builder_name: string | null
          project_id: string | null
          project_managers: Json | null
          project_name: string | null
          total_builder_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_builder"
            columns: ["primary_builder_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "fk_projects_builder"
            columns: ["primary_builder_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_projects_builder"
            columns: ["primary_builder_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_projects_builder"
            columns: ["primary_builder_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_projects_builder"
            columns: ["primary_builder_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
        ]
      }
      project_assignments_detailed: {
        Row: {
          actual_workers: number | null
          assignment_type: string | null
          contractor_role_category: string | null
          contractor_role_code: string | null
          contractor_role_name: string | null
          created_at: string | null
          employer_id: string | null
          employer_name: string | null
          end_date: string | null
          estimated_workers: number | null
          id: string | null
          is_primary_for_role: boolean | null
          notes: string | null
          project_id: string | null
          project_name: string | null
          start_date: string | null
          status: string | null
          trade_category: string | null
          trade_code: string | null
          trade_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "project_assignments_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      project_dashboard_summary: {
        Row: {
          delegate_name: string | null
          eba_active_employer_count: number | null
          engaged_employer_count: number | null
          estimated_total: number | null
          first_patch_name: string | null
          organiser_names: string | null
          project_id: string | null
          total_members: number | null
          total_workers: number | null
        }
        Insert: {
          delegate_name?: never
          eba_active_employer_count?: never
          engaged_employer_count?: never
          estimated_total?: never
          first_patch_name?: never
          organiser_names?: never
          project_id?: string | null
          total_members?: never
          total_workers?: never
        }
        Update: {
          delegate_name?: never
          eba_active_employer_count?: never
          engaged_employer_count?: never
          estimated_total?: never
          first_patch_name?: never
          organiser_names?: never
          project_id?: string | null
          total_members?: never
          total_workers?: never
        }
        Relationships: []
      }
      project_list_comprehensive_view: {
        Row: {
          builder_has_eba: boolean | null
          computed_at: string | null
          created_at: string | null
          delegate_name: string | null
          eba_active_employer_count: number | null
          eba_coverage_percent: number | null
          engaged_employer_count: number | null
          estimated_total: number | null
          first_patch_name: string | null
          full_address: string | null
          has_builder: boolean | null
          id: string | null
          main_job_site_id: string | null
          name: string | null
          organiser_names: string | null
          organising_universe:
            | Database["public"]["Enums"]["project_organising_universe"]
            | null
          project_assignments_data: Json | null
          search_text: string | null
          stage_class: Database["public"]["Enums"]["project_stage_class"] | null
          tier: string | null
          total_members: number | null
          total_workers: number | null
          updated_at: string | null
          value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_main_job_site"
            columns: ["main_job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_projects_main_job_site"
            columns: ["main_job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "fk_projects_main_job_site"
            columns: ["main_job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
        ]
      }
      project_subset_eba_stats: {
        Row: {
          eba_active_count: number | null
          eba_percentage: number | null
          known_employer_count: number | null
          project_id: string | null
          project_name: string | null
        }
        Relationships: []
      }
      projects_quick_search: {
        Row: {
          builder_name: string | null
          full_address: string | null
          id: string | null
          name: string | null
          search_vector: unknown | null
        }
        Relationships: []
      }
      site_representatives: {
        Row: {
          cfmeu_registration_submitted_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_role: Database["public"]["Enums"]["site_contact_role"] | null
          date_elected: string | null
          elected_by: string | null
          end_date: string | null
          first_name: string | null
          gets_paid_time: boolean | null
          home_address_line_1: string | null
          home_address_line_2: string | null
          home_address_postcode: string | null
          home_address_state: string | null
          home_address_suburb: string | null
          is_senior: boolean | null
          job_site_id: string | null
          mobile_phone: string | null
          ohs_refresher_training_date: string | null
          ohs_training_date: string | null
          project_name: string | null
          site_address: string | null
          site_contact_id: string | null
          site_estimated_completion_date: string | null
          site_name: string | null
          start_date: string | null
          surname: string | null
          union_membership_status:
            | Database["public"]["Enums"]["union_membership_status"]
            | null
          union_role_id: string | null
          union_role_name: Database["public"]["Enums"]["union_role_type"] | null
          worker_email: string | null
          worker_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_site_contacts_job_site"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_site_contacts_job_site"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "fk_site_contacts_job_site"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "union_roles_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "unallocated_workers_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_roles_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_roles_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visit_list_view: {
        Row: {
          computed_at: string | null
          created_at: string | null
          employer_id: string | null
          employer_name: string | null
          employers_data: Json | null
          estimated_workers_count: number | null
          id: string | null
          is_stale: boolean | null
          job_site_address: string | null
          job_site_id: string | null
          job_site_location: string | null
          job_site_name: string | null
          job_sites_data: Json | null
          objective: string | null
          outcomes_locked: boolean | null
          profiles_data: Json | null
          project_id: string | null
          project_name: string | null
          scheduled_at: string | null
          search_text: string | null
          sv_code: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      unallocated_workers_analysis: {
        Row: {
          allocation_status: string | null
          email: string | null
          employer_id: string | null
          employer_name: string | null
          first_name: string | null
          id: string | null
          job_site_id: string | null
          job_site_name: string | null
          member_number: string | null
          mobile_phone: string | null
          surname: string | null
          union_membership_status:
            | Database["public"]["Enums"]["union_membership_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "worker_placements_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "worker_placements_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
        ]
      }
      v_contractor_categories_catalog: {
        Row: {
          category_code: string | null
          category_name: string | null
          category_type: string | null
          current_employers: number | null
          total_employers: number | null
        }
        Relationships: []
      }
      v_eba_active_employer_categories: {
        Row: {
          category_code: string | null
          category_name: string | null
          category_type: string | null
          employer_id: string | null
          employer_name: string | null
          is_current: boolean | null
          project_id: string | null
          source: string | null
        }
        Relationships: []
      }
      v_employer_contractor_categories: {
        Row: {
          category_code: string | null
          category_name: string | null
          category_type: string | null
          employer_id: string | null
          employer_name: string | null
          is_current: boolean | null
          project_id: string | null
          source: string | null
        }
        Relationships: []
      }
      v_lead_patches_current: {
        Row: {
          lead_organiser_id: string | null
          patch_id: string | null
        }
        Insert: {
          lead_organiser_id?: string | null
          patch_id?: string | null
        }
        Update: {
          lead_organiser_id?: string | null
          patch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_organiser_patch_assignments_lead_organiser_id_fkey"
            columns: ["lead_organiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_organiser_patch_assignments_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_organiser_patch_assignments_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches_with_geojson"
            referencedColumns: ["id"]
          },
        ]
      }
      v_organiser_patches_current: {
        Row: {
          organiser_id: string | null
          patch_id: string | null
        }
        Insert: {
          organiser_id?: string | null
          patch_id?: string | null
        }
        Update: {
          organiser_id?: string | null
          patch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organiser_patch_assignments_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_patch_assignments_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_patch_assignments_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches_with_geojson"
            referencedColumns: ["id"]
          },
        ]
      }
      v_patch_employers_current: {
        Row: {
          employer_id: string | null
          patch_id: string | null
        }
        Insert: {
          employer_id?: string | null
          patch_id?: string | null
        }
        Update: {
          employer_id?: string | null
          patch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patch_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "patch_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patch_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patch_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patch_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "patch_employers_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patch_employers_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches_with_geojson"
            referencedColumns: ["id"]
          },
        ]
      }
      v_patch_sites_current: {
        Row: {
          job_site_id: string | null
          patch_id: string | null
        }
        Insert: {
          job_site_id?: string | null
          patch_id?: string | null
        }
        Update: {
          job_site_id?: string | null
          patch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patch_job_sites_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patch_job_sites_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "patch_job_sites_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "patch_job_sites_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patch_job_sites_patch_id_fkey"
            columns: ["patch_id"]
            isOneToOne: false
            referencedRelation: "patches_with_geojson"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_current_roles: {
        Row: {
          employer_id: string | null
          project_id: string | null
          role: Database["public"]["Enums"]["project_role"] | null
        }
        Insert: {
          employer_id?: string | null
          project_id?: string | null
          role?: Database["public"]["Enums"]["project_role"] | null
        }
        Update: {
          employer_id?: string | null
          project_id?: string | null
          role?: Database["public"]["Enums"]["project_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "project_employer_roles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "project_employer_roles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_employer_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
        ]
      }
      v_project_site_contractors: {
        Row: {
          eba_signatory: string | null
          eba_status: boolean | null
          employer_id: string | null
          end_date: string | null
          job_site_id: string | null
          project_id: string | null
          start_date: string | null
          trade_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "site_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "site_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_contractor_trades_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "site_contractor_trades_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_contractor_trades_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "site_contractor_trades_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
        ]
      }
      v_project_workers: {
        Row: {
          employer_id: string | null
          employment_status: string | null
          end_date: string | null
          job_site_id: string | null
          project_id: string | null
          start_date: string | null
          worker_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dashboard_project_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "organising_universe_impact_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_all_builders"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_list_comprehensive_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_subset_eba_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_quick_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_sites_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_analytics"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers_with_eba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["employer_id"]
          },
          {
            foreignKeyName: "worker_placements_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "patch_project_mapping_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "worker_placements_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "site_visit_list_view"
            referencedColumns: ["job_site_id"]
          },
          {
            foreignKeyName: "worker_placements_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "unallocated_workers_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_placements_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_unified_project_contractors: {
        Row: {
          employer_id: string | null
          project_id: string | null
          role: string | null
          source: string | null
        }
        Relationships: []
      }
      worker_list_view: {
        Row: {
          computed_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          job_site_names: string[] | null
          job_titles: string[] | null
          member_number: string | null
          mobile_phone: string | null
          nickname: string | null
          organiser_data: Json | null
          search_text: string | null
          surname: string | null
          union_membership_status:
            | Database["public"]["Enums"]["union_membership_status"]
            | null
          worker_placement_count: number | null
          worker_placements_data: Json[] | null
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
      _postgis_pgsql_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _postgis_scripts_pgsql_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_bestsrid: {
        Args: { "": unknown }
        Returns: number
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
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
      _st_equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
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
      _st_pointoutside: {
        Args: { "": unknown }
        Returns: unknown
      }
      _st_sortablehash: {
        Args: { geom: unknown }
        Returns: number
      }
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
      _st_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      activate_pending_user: {
        Args: { p_activated_email: string; p_pending_email: string }
        Returns: Json
      }
      add_project_managers: {
        Args: {
          p_employer_ids: string[]
          p_project_id: string
          p_start_date?: string
        }
        Returns: {
          employer_id: string
          message: string
          success: boolean
        }[]
      }
      addauth: {
        Args: { "": string }
        Returns: boolean
      }
      addgeometrycolumn: {
        Args:
          | {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
          | {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
          | {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
        Returns: string
      }
      admin_sync_all_lead_organiser_patches: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      admin_update_employer_full: {
        Args:
          | {
              p_employer_id: string
              p_role_tags: Database["public"]["Enums"]["employer_role_tag"][]
              p_trade_types: Database["public"]["Enums"]["trade_type"][]
              p_update: Json
            }
          | {
              p_employer_id: string
              p_role_tags?: Database["public"]["Enums"]["employer_role_tag"][]
              p_trade_caps?: string[]
              p_update: Json
            }
        Returns: {
          abn: string | null
          address_line_1: string | null
          address_line_2: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          bci_company_id: string | null
          contact_notes: string | null
          created_at: string | null
          email: string | null
          employer_type: Database["public"]["Enums"]["employer_type"]
          enterprise_agreement_status: boolean | null
          estimated_worker_count: number | null
          id: string
          incolink_id: string | null
          incolink_last_matched: string | null
          last_incolink_payment: string | null
          name: string
          parent_employer_id: string | null
          phone: string | null
          postcode: string | null
          primary_contact_name: string | null
          rejection_reason: string | null
          state: string | null
          suburb: string | null
          updated_at: string | null
          website: string | null
        }
      }
      admin_update_user_scoping: {
        Args: {
          _scoped_employers: string[]
          _scoped_sites: string[]
          _user_id: string
        }
        Returns: undefined
      }
      apply_feature_geometries_to_patch: {
        Args:
          | {
              p_feature_geometries_geojson: Json[]
              p_overwrite?: boolean
              p_patch_id: string
            }
          | {
              p_geometry_collection_geojson: Json
              p_overwrite?: boolean
              p_patch_id: string
            }
        Returns: undefined
      }
      apply_geometries_to_patch_wkt: {
        Args: {
          p_geometries_wkt: string[]
          p_overwrite?: boolean
          p_patch_id: string
        }
        Returns: undefined
      }
      apply_organising_universe_rules_retrospectively: {
        Args: { p_applied_by?: string; p_dry_run?: boolean }
        Returns: Json
      }
      apply_pending_user_on_login: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      approve_employer: {
        Args: {
          p_admin_user_id: string
          p_employer_id: string
          p_notes?: string
        }
        Returns: Json
      }
      approve_project: {
        Args: {
          p_admin_user_id: string
          p_notes?: string
          p_project_id: string
        }
        Returns: Json
      }
      assign_bci_builder: {
        Args: {
          p_company_name: string
          p_employer_id: string
          p_project_id: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      set_project_builder: {
        Args: {
          p_project_id: string
          p_employer_id?: string | null
          p_source?: string
          p_match_status?: string
          p_match_confidence?: number
          p_match_notes?: string
          p_confirmed_by?: string | null
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      assign_bci_trade_contractor: {
        Args: {
          p_company_name?: string
          p_employer_id: string
          p_estimated_workforce?: number
          p_match_confidence?: number
          p_match_notes?: string
          p_project_id: string
          p_stage?: string
          p_trade_type: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      assign_contractor_role: {
        Args:
          | {
              p_company_name: string
              p_employer_id: string
              p_is_primary?: boolean
              p_project_id: string
              p_role_code: string
              p_source?: string
              p_match_confidence?: number
              p_match_notes?: string
            }
          | {
              p_company_name: string
              p_employer_id: string
              p_is_primary?: boolean
              p_project_id: string
              p_role_code: string
              p_source?: string
              p_match_confidence?: number
              p_match_notes?: string
            }
          | {
              p_company_name: string
              p_employer_id: string
              p_is_primary?: boolean
              p_project_id: string
              p_role_code: string
              p_source?: string
              p_match_confidence?: number
              p_match_notes?: string
            }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      assign_contractor_trade: {
        Args: {
          p_company_name: string
          p_employer_id: string
          p_project_id: string
          p_trade_type: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      assign_contractor_unified: {
        Args: {
          p_eba_signatory?: string
          p_employer_id: string
          p_estimated_workforce?: number
          p_job_site_id: string
          p_project_id: string
          p_stage?: string
          p_trade_type: string
        }
        Returns: {
          assignment_id: string
          message: string
          project_role_id: string
          project_trade_id: string
          site_trade_id: string
          success: boolean
        }[]
      }
      assign_multiple_trade_types: {
        Args: {
          p_eba_signatory?: string
          p_employer_id: string
          p_estimated_workforce?: number
          p_project_id: string
          p_stage?: string
          p_trade_types: string[]
        }
        Returns: {
          assignment_id: string
          message: string
          success: boolean
          trade_type: string
        }[]
      }
      assign_patches_for_all_job_sites: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      assign_trade_work: {
        Args:
          | {
              p_company_name: string
              p_employer_id: string
              p_estimated_workers?: number
              p_match_confidence?: number
              p_match_notes?: string
              p_project_id: string
              p_source?: string
              p_trade_code: string
            }
          | {
              p_company_name: string
              p_employer_id: string
              p_estimated_workers?: number
              p_project_id: string
              p_trade_code: string
            }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      auto_refresh_employer_list_view: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      box: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box2d: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box2d_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2d_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2df_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2df_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3d: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box3d_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3d_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3dtobox: {
        Args: { "": unknown }
        Returns: unknown
      }
      bulk_assign_projects_to_patches: {
        Args: Record<PropertyKey, never>
        Returns: {
          assigned: number
          errors: number
        }[]
      }
      bulk_set_organising_universe_manual: {
        Args: {
          p_project_ids: string[]
          p_reason?: string
          p_universe: string
          p_user_id: string
        }
        Returns: Json
      }
      bytea: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      calculate_default_organising_universe: {
        Args: { p_project_id: string }
        Returns: string
      }
      calculate_eba_recency_score: {
        Args: { eba_record: Json }
        Returns: number
      }
      calculate_organizing_universe_metrics: {
        Args: {
          p_eba_filter?: string
          p_patch_ids?: string[]
          p_stage?: string
          p_tier?: string
          p_universe?: string
          p_user_id?: string
          p_user_role?: string
        }
        Returns: {
          eba_projects_count: number
          eba_projects_percentage: number
          key_contractor_coverage_percentage: number
          key_contractor_eba_builder_percentage: number
          key_contractor_eba_percentage: number
          key_contractors_on_eba_builder_projects: number
          key_contractors_with_eba: number
          known_builder_count: number
          known_builder_percentage: number
          mapped_key_contractors: number
          total_active_projects: number
          total_key_contractor_slots: number
          total_key_contractors_on_eba_builder_projects: number
          total_mapped_key_contractors: number
        }[]
      }
      can_access_employer: {
        Args: { target_employer_id: string }
        Returns: boolean
      }
      can_access_job_site: {
        Args: { target_job_site_id: string }
        Returns: boolean
      }
      can_access_organiser: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      can_access_worker: {
        Args: { target_worker_id: string }
        Returns: boolean
      }
      check_materialized_view_staleness: {
        Args: Record<PropertyKey, never>
        Returns: {
          minutes_old: number
          needs_refresh: boolean
          record_count: number
          view_name: string
        }[]
      }
      check_patch_project_mapping_health: {
        Args: Record<PropertyKey, never>
        Returns: {
          is_healthy: boolean
          last_refreshed_estimate: string
          recommendation: string
          record_count: number
          view_name: string
        }[]
      }
      cleanup_expired_tokens: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      clear_organising_universe_automation: {
        Args: { p_confirm_clear?: boolean }
        Returns: Json
      }
      close_lead_patch: {
        Args: { p_lead: string; p_patch: string }
        Returns: undefined
      }
      close_organiser_patch: {
        Args: { p_org: string; p_patch: string }
        Returns: undefined
      }
      close_patch_employer: {
        Args: { p_emp: string; p_patch: string }
        Returns: undefined
      }
      close_patch_site: {
        Args: { p_patch: string; p_site: string }
        Returns: undefined
      }
      compute_patches_for_lead_organiser: {
        Args: { p_lead_organiser_id: string }
        Returns: string[]
      }
      confirm_assignment: {
        Args: {
          assignment_id: string
          assignment_table: string
          user_id?: string
        }
        Returns: undefined
      }
      consolidate_duplicate_assignments: {
        Args: Record<PropertyKey, never>
        Returns: {
          assignments_merged: number
          duplicates_removed: number
        }[]
      }
      create_batch_upload_with_scans: {
        Args: { p_batch_data: Json; p_scans: Json; p_user_id: string }
        Returns: Json
      }
      create_patch_with_geometry: {
        Args: {
          p_code?: string
          p_created_by?: string
          p_description?: string
          p_geometry?: string
          p_name: string
          p_type?: string
        }
        Returns: string
      }
      create_project_from_scan: {
        Args:
          | {
              p_contacts?: Json
              p_employer_creations?: Json
              p_project_data: Json
              p_require_approval?: boolean
              p_scan_id: string
              p_subcontractors?: Json
              p_user_id: string
            }
          | {
              p_contacts?: Json
              p_employer_creations?: Json
              p_project_data: Json
              p_scan_id: string
              p_subcontractors?: Json
              p_user_id: string
            }
        Returns: Json
      }
      delete_project_cascade: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      disablelongtransactions: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      dropgeometrycolumn: {
        Args:
          | {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
          | { column_name: string; schema_name: string; table_name: string }
          | { column_name: string; table_name: string }
        Returns: string
      }
      dropgeometrytable: {
        Args:
          | { catalog_name: string; schema_name: string; table_name: string }
          | { schema_name: string; table_name: string }
          | { table_name: string }
        Returns: string
      }
      enablelongtransactions: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      find_nearby_projects: {
        Args: {
          max_distance_km?: number
          max_results?: number
          search_address?: string
          search_lat: number
          search_lng: number
        }
        Returns: {
          builder_name: string
          distance_km: number
          is_exact_match: boolean
          job_site_address: string
          job_site_id: string
          job_site_name: string
          latitude: number
          longitude: number
          organising_universe: string
          project_id: string
          project_name: string
          project_tier: string
          project_value: number
          stage_class: string
        }[]
      }
      find_patch_for_coordinates: {
        Args: { lat: number; lng: number }
        Returns: {
          distance: number
          id: string
          name: string
        }[]
      }
      generate_compliance_alerts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_secure_token: {
        Args: { length?: number }
        Returns: string
      }
      geography: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      geography_analyze: {
        Args: { "": unknown }
        Returns: boolean
      }
      geography_gist_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_gist_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_send: {
        Args: { "": unknown }
        Returns: string
      }
      geography_spgist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      geography_typmod_out: {
        Args: { "": number }
        Returns: unknown
      }
      geometry: {
        Args:
          | { "": string }
          | { "": string }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
        Returns: unknown
      }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_analyze: {
        Args: { "": unknown }
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
      geometry_gist_compress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_decompress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_decompress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_sortsupport_2d: {
        Args: { "": unknown }
        Returns: undefined
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_hash: {
        Args: { "": unknown }
        Returns: number
      }
      geometry_in: {
        Args: { "": unknown }
        Returns: unknown
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
      geometry_out: {
        Args: { "": unknown }
        Returns: unknown
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
      geometry_recv: {
        Args: { "": unknown }
        Returns: unknown
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
      geometry_send: {
        Args: { "": unknown }
        Returns: string
      }
      geometry_sortsupport: {
        Args: { "": unknown }
        Returns: undefined
      }
      geometry_spgist_compress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_spgist_compress_3d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_spgist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      geometry_typmod_out: {
        Args: { "": number }
        Returns: unknown
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometrytype: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      geomfromewkb: {
        Args: { "": string }
        Returns: unknown
      }
      geomfromewkt: {
        Args: { "": string }
        Returns: unknown
      }
      get_accessible_workers: {
        Args: { user_id: string }
        Returns: {
          worker_id: string
        }[]
      }
      get_app_setting: {
        Args: { _key: string }
        Returns: string
      }
      get_eba_category: {
        Args: { eba_record: Json }
        Returns: string
      }
      get_employer_merge_impact: {
        Args: { p_employer_ids: string[] }
        Returns: {
          aliases_count: number
          builder_projects_count: number
          eba_records_count: number
          employer_id: string
          employer_name: string
          project_roles_count: number
          project_trades_count: number
          site_trades_count: number
          site_visits_count: number
          trade_capabilities_count: number
          worker_placements_count: number
        }[]
      }
      get_employer_sites: {
        Args: { p_employer_id: string }
        Returns: {
          id: string
          name: string
          project_id: string
          project_name: string
        }[]
      }
      get_employer_worker_count: {
        Args: { p_employer_id: string }
        Returns: number
      }
      get_patch_summaries_for_user: {
        Args: {
          p_filters?: Json
          p_lead_organiser_id?: string
          p_user_id?: string
          p_user_role?: string
        }
        Returns: {
          eba_projects_count: number
          eba_projects_percentage: number
          key_contractor_coverage: number
          key_contractor_eba_percentage: number
          known_builder_count: number
          known_builder_percentage: number
          last_updated: string
          organiser_names: string[]
          patch_id: string
          patch_name: string
          project_count: number
        }[]
      }
      get_patches_with_geometry_text: {
        Args: Record<PropertyKey, never>
        Returns: {
          code: string
          geom: string
          id: string
          name: string
          status: string
          type: string
        }[]
      }
      get_proj4_from_srid: {
        Args: { "": number }
        Returns: string
      }
      get_project_counts: {
        Args: Record<PropertyKey, never>
        Returns: {
          count: number
          organising_universe: string
          stage_class: string
        }[]
      }
      get_project_delete_impact: {
        Args: { p_project_id: string }
        Returns: {
          project_builder_jv_count: number
          project_contractor_trades_count: number
          project_eba_details_count: number
          project_employer_roles_count: number
          project_organisers_count: number
          site_contacts_count: number
          site_contractor_trades_count: number
          site_count: number
          site_employers_count: number
          union_activities_count: number
          worker_placements_count: number
        }[]
      }
      get_project_employers_unknown_eba: {
        Args: Record<PropertyKey, never>
        Returns: {
          eba_status: string
          id: string
          name: string
          project_count: number
          projects: Json
        }[]
      }
      get_project_subset_stats: {
        Args: { p_project_id: string }
        Returns: {
          eba_active_count: number
          eba_percentage: number
          known_employer_count: number
        }[]
      }
      get_project_tier_color: {
        Args: { tier_value: string }
        Returns: string
      }
      get_project_tier_label: {
        Args: { tier_value: string }
        Returns: string
      }
      get_projects_for_map_view: {
        Args: Record<PropertyKey, never>
        Returns: {
          builder_status: string
          id: string
          latitude: number
          longitude: number
          name: string
          organising_universe: string
          stage_class: string
          tier: string
        }[]
      }
      get_projects_with_builder: {
        Args: { project_ids: string[] }
        Returns: {
          project_id: string
        }[]
      }
      get_public_form_contractor_roles: {
        Args: { p_project_id: string; p_token: string }
        Returns: Json
      }
      get_public_form_data: {
        Args: { p_token: string }
        Returns: Json
      }
      get_public_form_reference_data: {
        Args: { p_token: string }
        Returns: Json
      }
      get_public_form_trade_contractors: {
        Args: { p_project_id: string; p_token: string }
        Returns: Json
      }
      get_site_manager_phone: {
        Args: { site_id: string }
        Returns: string
      }
      get_trade_type_enum: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      get_unified_contractors: {
        Args: { p_project_id: string }
        Returns: {
          assignments: Json
          employer_id: string
          employer_name: string
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: string
      }
      gettransactionid: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      gidx_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gidx_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
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
      handle_contractor_role_updates: {
        Args: { p_project_id: string; p_token: string; p_updates: Json }
        Returns: Json
      }
      handle_trade_contractor_updates: {
        Args: { p_project_id: string; p_token: string; p_updates: Json }
        Returns: Json
      }
      has_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      has_site_access: {
        Args: { site_id: string; user_id: string }
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
      insert_patch_from_geojson: {
        Args: {
          geojson_data: string
          patch_code: string
          patch_name: string
          source_file: string
          user_id: string
        }
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_employer_engaged: {
        Args: {
          eba_category: string
          estimated_worker_count: number
          project_assignment_count: number
          worker_placement_count: number
        }
        Returns: boolean
      }
      is_lead: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_lead_of: {
        Args: { _child: string; _parent: string }
        Returns: boolean
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
      json: {
        Args: { "": unknown }
        Returns: Json
      }
      jsonb: {
        Args: { "": unknown }
        Returns: Json
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      link_eba_to_employer: {
        Args: { p_eba_data: Json; p_employer_id: string }
        Returns: undefined
      }
      log_help_interaction: {
        Args: {
          p_ai_provider: string
          p_answer: string
          p_confidence: number
          p_context: Json
          p_question: string
          p_response_time_ms: number
          p_sources: Json
          p_tokens_used: number
          p_user_id: string
        }
        Returns: Json
      }
      longtransactionsenabled: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      mark_assignment_auto_matched: {
        Args: {
          assignment_id: string
          assignment_table: string
          confidence?: number
          notes?: string
        }
        Returns: undefined
      }
      match_help_documents: {
        Args: {
          filter_page?: string
          filter_roles?: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          doc_id: string
          id: string
          related_docs: string[]
          screenshots: string[]
          similarity: number
          steps: Json
          title: string
        }[]
      }
      match_job_sites_to_patches: {
        Args: Record<PropertyKey, never>
        Returns: {
          patches_used: number
          sites_matched: number
          sites_processed: number
        }[]
      }
      defer_canonical_promotion: {
        Args: {
          p_alias_id: string
          p_decision_rationale: string
        }
        Returns: Json
      }
      merge_employers: {
        Args: {
          p_duplicate_employer_ids: string[]
          p_primary_employer_id: string
        }
        Returns: Json
      }
      merge_patch_geometry: {
        Args: { p_patch_id: string; p_srid?: number; p_wkt: string }
        Returns: undefined
      }
      normalize_employer_name: {
        Args: { input_name: string }
        Returns: string
      }
      parse_kml_content: {
        Args: { kml_content: string; source_file: string }
        Returns: {
          patch_code: string
          patch_id: string
        }[]
      }
      promote_alias_to_canonical: {
        Args: {
          p_alias_id: string
          p_decision_rationale?: string
        }
        Returns: Json
      }
      get_alias_metrics_range: {
        Args: {
          p_start_date?: string
          p_end_date?: string
        }
        Returns: {
          metric_date: string
          aliases_created: number
          authoritative_created: number
          employers_affected: number
          promotions: number
          rejections: number
          deferrals: number
          by_source_system: Json
        }[]
      }
      get_employer_aliases: {
        Args: {
          p_employer_id: string
        }
        Returns: Json
      }
      reject_canonical_promotion: {
        Args: {
          p_alias_id: string
          p_decision_rationale: string
        }
        Returns: Json
      }
      search_employers_with_aliases: {
        Args: {
          p_query: string
          p_limit?: number
          p_offset?: number
          p_include_aliases?: boolean
          p_alias_match_mode?: string
        }
        Returns: {
          id: string
          name: string
          abn: string | null
          employer_type: Database["public"]["Enums"]["employer_type"]
          website: string | null
          email: string | null
          phone: string | null
          estimated_worker_count: number | null
          incolink_id: string | null
          bci_company_id: string | null
          enterprise_agreement_status: boolean | null
          eba_status_source: Database["public"]["Enums"]["eba_status_source"] | null
          eba_status_updated_at: string | null
          eba_status_notes: string | null
          aliases: Json
          match_type: string
          match_details: Json
          search_score: number
        }[]
      }
      path: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_asflatgeobuf_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asgeobuf_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asmvt_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asmvt_serialfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_geometry_clusterintersecting_finalfn: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      pgis_geometry_clusterwithin_finalfn: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      pgis_geometry_collect_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_makeline_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_polygonize_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_union_parallel_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_union_parallel_serialfn: {
        Args: { "": unknown }
        Returns: string
      }
      point: {
        Args: { "": unknown }
        Returns: unknown
      }
      polygon: {
        Args: { "": unknown }
        Returns: unknown
      }
      populate_geometry_columns: {
        Args:
          | { tbl_oid: unknown; use_typmod?: boolean }
          | { use_typmod?: boolean }
        Returns: string
      }
      postgis_addbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
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
      postgis_dropbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_extensions_upgrade: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_full_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_geos_noop: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_geos_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_getbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_hasbbox: {
        Args: { "": unknown }
        Returns: boolean
      }
      postgis_index_supportfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_lib_build_date: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_lib_revision: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_lib_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libjson_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_liblwgeom_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libprotobuf_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libxml_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_noop: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_proj_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_build_date: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_installed: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_released: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_svn_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_typmod_dims: {
        Args: { "": number }
        Returns: number
      }
      postgis_typmod_srid: {
        Args: { "": number }
        Returns: number
      }
      postgis_typmod_type: {
        Args: { "": number }
        Returns: string
      }
      postgis_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_wagyu_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      project_has_pending_scan: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      refresh_all_materialized_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_employer_eba_status: {
        Args: { p_employer_id: string }
        Returns: undefined
      }
      set_employer_eba_status: {
        Args: {
          p_employer_id: string
          p_status: boolean
          p_source: Database["public"]["Enums"]["eba_status_source"]
          p_notes?: string | null
        }
        Returns: Database["public"]["Tables"]["employers"]["Row"]
      }
      refresh_employer_list_view: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_employer_related_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_patch_project_mapping_view: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_project_list_comprehensive_view: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_project_related_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_site_visit_list_view: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_site_visit_related_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_worker_list_view: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_worker_related_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reject_employer: {
        Args: {
          p_admin_user_id: string
          p_employer_id: string
          p_reason: string
        }
        Returns: Json
      }
      reject_project: {
        Args: {
          p_admin_user_id: string
          p_project_id: string
          p_reason: string
        }
        Returns: Json
      }
      remove_organising_universe_manual_override: {
        Args: { p_project_id: string; p_reason?: string; p_user_id: string }
        Returns: Json
      }
      resolve_trade_type_conflicts: {
        Args: Record<PropertyKey, never>
        Returns: {
          conflicts_found: number
          conflicts_resolved: number
          details: string
        }[]
      }
      rollback_organising_universe_changes: {
        Args: { p_applied_by?: string; p_confirm_rollback?: boolean }
        Returns: Json
      }
      search_all_projects: {
        Args: { search_query: string }
        Returns: {
          builder: string
          id: string
          project_address: string
          project_name: string
          project_number: string
        }[]
      }
      search_employers_by_exact_name: {
        Args: { name_query: string }
        Returns: {
          abn: string | null
          address_line_1: string | null
          address_line_2: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          bci_company_id: string | null
          contact_notes: string | null
          created_at: string | null
          email: string | null
          employer_type: Database["public"]["Enums"]["employer_type"]
          enterprise_agreement_status: boolean | null
          estimated_worker_count: number | null
          id: string
          incolink_id: string | null
          incolink_last_matched: string | null
          last_incolink_payment: string | null
          name: string
          parent_employer_id: string | null
          phone: string | null
          postcode: string | null
          primary_contact_name: string | null
          rejection_reason: string | null
          state: string | null
          suburb: string | null
          updated_at: string | null
          website: string | null
        }[]
      }
      search_employers_by_name_fuzzy: {
        Args: { search_term: string }
        Returns: {
          abn: string | null
          address_line_1: string | null
          address_line_2: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          bci_company_id: string | null
          contact_notes: string | null
          created_at: string | null
          email: string | null
          employer_type: Database["public"]["Enums"]["employer_type"]
          enterprise_agreement_status: boolean | null
          estimated_worker_count: number | null
          id: string
          incolink_id: string | null
          incolink_last_matched: string | null
          last_incolink_payment: string | null
          name: string
          parent_employer_id: string | null
          phone: string | null
          postcode: string | null
          primary_contact_name: string | null
          rejection_reason: string | null
          state: string | null
          suburb: string | null
          updated_at: string | null
          website: string | null
        }[]
      }
      search_projects_basic: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          builder_name: string
          full_address: string
          id: string
          name: string
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      set_organising_universe_manual: {
        Args: {
          p_project_id: string
          p_reason?: string
          p_universe: string
          p_user_id: string
        }
        Returns: Json
      }
      set_patch_geometries_from_wkt: {
        Args: { p_geometries_wkt: string[]; p_patch_id: string }
        Returns: undefined
      }
      set_patch_geometry_from_features: {
        Args: { p_feature_geometries_geojson: Json[]; p_patch_id: string }
        Returns: undefined
      }
      should_auto_update_organising_universe: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
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
      spheroid_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      spheroid_out: {
        Args: { "": unknown }
        Returns: unknown
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
      st_3dlength: {
        Args: { "": unknown }
        Returns: number
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
      st_3dperimeter: {
        Args: { "": unknown }
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
      st_angle: {
        Args:
          | { line1: unknown; line2: unknown }
          | { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
        Returns: number
      }
      st_area: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_area2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_asbinary: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkb: {
        Args: { "": unknown }
        Returns: string
      }
      st_asewkt: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      st_asgeojson: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; options?: number }
          | { geom: unknown; maxdecimaldigits?: number; options?: number }
          | {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
        Returns: string
      }
      st_asgml: {
        Args:
          | { "": string }
          | {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
          | {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
          | {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
          | { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_ashexewkb: {
        Args: { "": unknown }
        Returns: string
      }
      st_askml: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
          | { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
        Returns: string
      }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: {
        Args: { format?: string; geom: unknown }
        Returns: string
      }
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
      st_assvg: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; rel?: number }
          | { geom: unknown; maxdecimaldigits?: number; rel?: number }
        Returns: string
      }
      st_astext: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      st_astwkb: {
        Args:
          | {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
          | {
              geom: unknown
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
      st_azimuth: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_boundary: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer: {
        Args:
          | { geom: unknown; options?: string; radius: number }
          | { geom: unknown; quadsegs: number; radius: number }
        Returns: unknown
      }
      st_buildarea: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_centroid: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      st_cleangeometry: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_clusterintersecting: {
        Args: { "": unknown[] }
        Returns: unknown[]
      }
      st_collect: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collectionextract: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_collectionhomogenize: {
        Args: { "": unknown }
        Returns: unknown
      }
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
      st_convexhull: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_coorddim: {
        Args: { geometry: unknown }
        Returns: number
      }
      st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
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
      st_dimension: {
        Args: { "": unknown }
        Returns: number
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance: {
        Args:
          | { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
          | { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_distancesphere: {
        Args:
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; radius: number }
        Returns: number
      }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dump: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumppoints: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumprings: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumpsegments: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
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
      st_endpoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_envelope: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_expand: {
        Args:
          | { box: unknown; dx: number; dy: number }
          | { box: unknown; dx: number; dy: number; dz?: number }
          | { dm?: number; dx: number; dy: number; dz?: number; geom: unknown }
        Returns: unknown
      }
      st_exteriorring: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_flipcoordinates: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_force2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_force3d: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
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
      st_forcecollection: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcecurve: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcepolygonccw: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcepolygoncw: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcerhr: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcesfs: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_generatepoints: {
        Args:
          | { area: unknown; npoints: number }
          | { area: unknown; npoints: number; seed: number }
        Returns: unknown
      }
      st_geogfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geogfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geographyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geohash: {
        Args:
          | { geog: unknown; maxchars?: number }
          | { geom: unknown; maxchars?: number }
        Returns: string
      }
      st_geomcollfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomcollfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geometrytype: {
        Args: { "": unknown }
        Returns: string
      }
      st_geomfromewkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromewkt: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromgeojson: {
        Args: { "": Json } | { "": Json } | { "": string }
        Returns: unknown
      }
      st_geomfromgml: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromkml: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfrommarc21: {
        Args: { marc21xml: string }
        Returns: unknown
      }
      st_geomfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromtwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_gmltosql: {
        Args: { "": string }
        Returns: unknown
      }
      st_hasarc: {
        Args: { geometry: unknown }
        Returns: boolean
      }
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
      st_intersects: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_isclosed: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_iscollection: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isempty: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_ispolygonccw: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_ispolygoncw: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isring: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_issimple: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isvalid: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
      }
      st_isvalidreason: {
        Args: { "": unknown }
        Returns: string
      }
      st_isvalidtrajectory: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_length: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_length2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_letters: {
        Args: { font?: Json; letters: string }
        Returns: unknown
      }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefrommultipoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_linefromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_linefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linemerge: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_linestringfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_linetocurve: {
        Args: { geometry: unknown }
        Returns: unknown
      }
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
      st_m: {
        Args: { "": unknown }
        Returns: number
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makepolygon: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { "": unknown } | { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_maximuminscribedcircle: {
        Args: { "": unknown }
        Returns: Record<string, unknown>
      }
      st_memsize: {
        Args: { "": unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_minimumboundingradius: {
        Args: { "": unknown }
        Returns: Record<string, unknown>
      }
      st_minimumclearance: {
        Args: { "": unknown }
        Returns: number
      }
      st_minimumclearanceline: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_mlinefromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mlinefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpolyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpolyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multi: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_multilinefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multilinestringfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipolyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipolygonfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_ndims: {
        Args: { "": unknown }
        Returns: number
      }
      st_node: {
        Args: { g: unknown }
        Returns: unknown
      }
      st_normalize: {
        Args: { geom: unknown }
        Returns: unknown
      }
      st_npoints: {
        Args: { "": unknown }
        Returns: number
      }
      st_nrings: {
        Args: { "": unknown }
        Returns: number
      }
      st_numgeometries: {
        Args: { "": unknown }
        Returns: number
      }
      st_numinteriorring: {
        Args: { "": unknown }
        Returns: number
      }
      st_numinteriorrings: {
        Args: { "": unknown }
        Returns: number
      }
      st_numpatches: {
        Args: { "": unknown }
        Returns: number
      }
      st_numpoints: {
        Args: { "": unknown }
        Returns: number
      }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_orientedenvelope: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { "": unknown } | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_perimeter2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_pointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_pointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointonsurface: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_points: {
        Args: { "": unknown }
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
      st_polyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_polyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonize: {
        Args: { "": unknown[] }
        Returns: unknown
      }
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
      st_relate: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: string
      }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_reverse: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid: {
        Args: { geog: unknown; srid: number } | { geom: unknown; srid: number }
        Returns: unknown
      }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shiftlongitude: {
        Args: { "": unknown }
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
      st_split: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid: {
        Args: { geog: unknown } | { geom: unknown }
        Returns: number
      }
      st_startpoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_summary: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
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
      st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_transform: {
        Args:
          | { from_proj: string; geom: unknown; to_proj: string }
          | { from_proj: string; geom: unknown; to_srid: number }
          | { geom: unknown; to_proj: string }
        Returns: unknown
      }
      st_triangulatepolygon: {
        Args: { g1: unknown }
        Returns: unknown
      }
      st_union: {
        Args:
          | { "": unknown[] }
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; gridsize: number }
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
      st_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_wkbtosql: {
        Args: { wkb: string }
        Returns: unknown
      }
      st_wkttosql: {
        Args: { "": string }
        Returns: unknown
      }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      st_x: {
        Args: { "": unknown }
        Returns: number
      }
      st_xmax: {
        Args: { "": unknown }
        Returns: number
      }
      st_xmin: {
        Args: { "": unknown }
        Returns: number
      }
      st_y: {
        Args: { "": unknown }
        Returns: number
      }
      st_ymax: {
        Args: { "": unknown }
        Returns: number
      }
      st_ymin: {
        Args: { "": unknown }
        Returns: number
      }
      st_z: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmax: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmflag: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmin: {
        Args: { "": unknown }
        Returns: number
      }
      submit_public_form: {
        Args: { p_submission: Json; p_token: string }
        Returns: Json
      }
      sync_all_lead_organizer_patches: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      sync_auth_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          message: string
          synced_count: number
        }[]
      }
      sync_employer_project_site_assignments: {
        Args: Record<PropertyKey, never>
        Returns: {
          details: string
          error_count: number
          synced_count: number
        }[]
      }
      sync_lead_organiser_patches: {
        Args: { p_lead_organiser_id: string }
        Returns: Json
      }
      text: {
        Args: { "": unknown }
        Returns: string
      }
      unaccent: {
        Args: { "": string }
        Returns: string
      }
      unaccent_init: {
        Args: { "": unknown }
        Returns: unknown
      }
      unlockrows: {
        Args: { "": string }
        Returns: number
      }
      update_batch_progress: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
      update_organising_universe_with_rules: {
        Args: {
          p_applied_by?: string
          p_project_id: string
          p_respect_manual_override?: boolean
        }
        Returns: Json
      }
      update_patch_geometry: {
        Args: { p_geometry: string; p_patch_id: string; p_updated_by?: string }
        Returns: undefined
      }
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
      upsert_lead_patch: {
        Args: { p_lead: string; p_patch: string }
        Returns: undefined
      }
      upsert_organiser_patch: {
        Args: { p_org: string; p_patch: string }
        Returns: undefined
      }
      upsert_patch_employer: {
        Args: { p_emp: string; p_patch: string }
        Returns: undefined
      }
      upsert_patch_geometry: {
        Args: { p_feature_geometry: Json; p_patch_ids: string[] }
        Returns: undefined
      }
      upsert_patch_site: {
        Args: { p_patch: string; p_site: string }
        Returns: undefined
      }
      user_can_access_project: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      user_has_pending_new_project_scan: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      validate_contractor_assignments: {
        Args: Record<PropertyKey, never>
        Returns: {
          details: string
          issue_count: number
          validation_type: string
        }[]
      }
      validate_public_token: {
        Args: { p_token: string }
        Returns: {
          error_message: string
          expires_at: string
          resource_id: string
          resource_type: string
          valid: boolean
        }[]
      }
      validate_trade_type: {
        Args: { trade_type_value: string }
        Returns: boolean
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
      activity_type:
        | "strike"
        | "training"
        | "conversation"
        | "action"
        | "meeting"
        | "financial_standing_list_audit"
      dd_status_type: "not_started" | "in_progress" | "active" | "failed"
      eba_status: "yes" | "no" | "pending"
      eba_status_source: "unknown" | "fwc_scraper" | "import" | "manual"
      eba_status_type: "yes" | "no" | "not_specified"
      employer_role_tag: "builder" | "head_contractor"
      employer_type:
        | "individual"
        | "small_contractor"
        | "large_contractor"
        | "principal_contractor"
        | "builder"
      employment_status:
        | "permanent"
        | "casual"
        | "subcontractor"
        | "apprentice"
        | "trainee"
      jv_status: "yes" | "no" | "unsure"
      payment_method_type:
        | "direct_debit"
        | "payroll_deduction"
        | "cash"
        | "card"
        | "unknown"
      project_organising_universe: "active" | "potential" | "excluded"
      project_role:
        | "head_contractor"
        | "contractor"
        | "trade_subcontractor"
        | "builder"
        | "project_manager"
      project_stage_class:
        | "future"
        | "pre_construction"
        | "construction"
        | "archived"
      project_type: "government" | "private" | "mixed"
      rating_type:
        | "support_level"
        | "leadership"
        | "risk"
        | "activity_participation"
      scraper_job_status:
        | "queued"
        | "running"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "processing"
      scraper_job_type: "fwc_lookup" | "incolink_sync" | "mapping_sheet_scan"
      shift_type: "day" | "night" | "split" | "weekend"
      site_contact_role:
        | "project_manager"
        | "site_manager"
        | "site_delegate"
        | "site_hsr"
      trade_stage: "early_works" | "structure" | "finishing" | "other"
      trade_type:
        | "scaffolding"
        | "form_work"
        | "reinforcing_steel"
        | "concrete"
        | "crane_and_rigging"
        | "plant_and_equipment"
        | "electrical"
        | "plumbing"
        | "carpentry"
        | "painting"
        | "flooring"
        | "roofing"
        | "glazing"
        | "landscaping"
        | "demolition"
        | "earthworks"
        | "structural_steel"
        | "mechanical_services"
        | "fire_protection"
        | "security_systems"
        | "cleaning"
        | "traffic_management"
        | "waste_management"
        | "general_construction"
        | "other"
        | "tower_crane"
        | "mobile_crane"
        | "post_tensioning"
        | "concreting"
        | "steel_fixing"
        | "bricklaying"
        | "traffic_control"
        | "labour_hire"
        | "windows"
        | "waterproofing"
        | "plastering"
        | "edge_protection"
        | "hoist"
        | "kitchens"
        | "tiling"
        | "piling"
        | "excavations"
        | "facade"
        | "final_clean"
        | "foundations"
        | "ceilings"
        | "stairs_balustrades"
        | "building_services"
        | "civil_infrastructure"
        | "fitout"
        | "insulation"
        | "technology"
        | "pools"
        | "pipeline"
      training_status: "completed" | "in_progress" | "cancelled" | "no_show"
      union_membership_status:
        | "member"
        | "non_member"
        | "potential"
        | "declined"
        | "unknown"
      union_role_type:
        | "member"
        | "hsr"
        | "site_delegate"
        | "shift_delegate"
        | "company_delegate"
        | "contact"
        | "health_safety_committee"
        | "ohs_committee_chair"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown | null
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown | null
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
      activity_type: [
        "strike",
        "training",
        "conversation",
        "action",
        "meeting",
        "financial_standing_list_audit",
      ],
      dd_status_type: ["not_started", "in_progress", "active", "failed"],
      eba_status: ["yes", "no", "pending"],
      eba_status_source: ["unknown", "fwc_scraper", "import", "manual"],
      eba_status_type: ["yes", "no", "not_specified"],
      employer_role_tag: ["builder", "head_contractor"],
      employer_type: [
        "individual",
        "small_contractor",
        "large_contractor",
        "principal_contractor",
        "builder",
      ],
      employment_status: [
        "permanent",
        "casual",
        "subcontractor",
        "apprentice",
        "trainee",
      ],
      jv_status: ["yes", "no", "unsure"],
      payment_method_type: [
        "direct_debit",
        "payroll_deduction",
        "cash",
        "card",
        "unknown",
      ],
      project_organising_universe: ["active", "potential", "excluded"],
      project_role: [
        "head_contractor",
        "contractor",
        "trade_subcontractor",
        "builder",
        "project_manager",
      ],
      project_stage_class: [
        "future",
        "pre_construction",
        "construction",
        "archived",
      ],
      project_type: ["government", "private", "mixed"],
      rating_type: [
        "support_level",
        "leadership",
        "risk",
        "activity_participation",
      ],
      scraper_job_status: [
        "queued",
        "running",
        "succeeded",
        "failed",
        "cancelled",
        "processing",
      ],
      scraper_job_type: ["fwc_lookup", "incolink_sync", "mapping_sheet_scan"],
      shift_type: ["day", "night", "split", "weekend"],
      site_contact_role: [
        "project_manager",
        "site_manager",
        "site_delegate",
        "site_hsr",
      ],
      trade_stage: ["early_works", "structure", "finishing", "other"],
      trade_type: [
        "scaffolding",
        "form_work",
        "reinforcing_steel",
        "concrete",
        "crane_and_rigging",
        "plant_and_equipment",
        "electrical",
        "plumbing",
        "carpentry",
        "painting",
        "flooring",
        "roofing",
        "glazing",
        "landscaping",
        "demolition",
        "earthworks",
        "structural_steel",
        "mechanical_services",
        "fire_protection",
        "security_systems",
        "cleaning",
        "traffic_management",
        "waste_management",
        "general_construction",
        "other",
        "tower_crane",
        "mobile_crane",
        "post_tensioning",
        "concreting",
        "steel_fixing",
        "bricklaying",
        "traffic_control",
        "labour_hire",
        "windows",
        "waterproofing",
        "plastering",
        "edge_protection",
        "hoist",
        "kitchens",
        "tiling",
        "piling",
        "excavations",
        "facade",
        "final_clean",
        "foundations",
        "ceilings",
        "stairs_balustrades",
        "building_services",
        "civil_infrastructure",
        "fitout",
        "insulation",
        "technology",
        "pools",
        "pipeline",
      ],
      training_status: ["completed", "in_progress", "cancelled", "no_show"],
      union_membership_status: [
        "member",
        "non_member",
        "potential",
        "declined",
        "unknown",
      ],
      union_role_type: [
        "member",
        "hsr",
        "site_delegate",
        "shift_delegate",
        "company_delegate",
        "contact",
        "health_safety_committee",
        "ohs_committee_chair",
      ],
    },
  },
} as const