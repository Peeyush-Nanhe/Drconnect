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
        doctor_appointments: {
          Row: {
            id: string
            provider_id: string
            patient_id: string
            service: string
            start_time: string
            end_time: string
            status: string
            created_at: string
          }
          Insert: {
            id?: string
            provider_id: string
            patient_id: string
            service: string
            start_time: string
            end_time: string
            status?: string
            created_at?: string
          }
          Update: {
            id?: string
            provider_id?: string
            patient_id?: string
            service?: string
            start_time?: string
            end_time?: string
            status?: string
            created_at?: string
          }
          Relationships: [
            {
              foreignKeyName: "doctor_appointments_patient_id_fkey"
              columns: ["patient_id"]
              referencedRelation: "users"
              referencedColumns: ["id"]
            },
            {
              foreignKeyName: "doctor_appointments_provider_id_fkey"
              columns: ["provider_id"]
              referencedRelation: "users"
              referencedColumns: ["id"]
            }
          ]
        }
      account_role_requests: {
        Row: {
          created_at: string
          requested_role: Database["public"]["Enums"]["app_role"]
          requested_view: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          requested_role: Database["public"]["Enums"]["app_role"]
          requested_view?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          requested_role?: Database["public"]["Enums"]["app_role"]
          requested_view?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_role_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_role_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_history: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          share_token: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          share_token?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          share_token?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blood_bank_activity: {
        Row: {
          activity_type: string
          blood_group: string | null
          camp_id: string | null
          camp_name: string | null
          created_at: string
          donor_name: string | null
          hospital: string | null
          id: string
          patient_id: string
          payload: Json
          status: string
          units: number | null
          updated_at: string
          urgent: boolean | null
        }
        Insert: {
          activity_type: string
          blood_group?: string | null
          camp_id?: string | null
          camp_name?: string | null
          created_at?: string
          donor_name?: string | null
          hospital?: string | null
          id?: string
          patient_id: string
          payload?: Json
          status?: string
          units?: number | null
          updated_at?: string
          urgent?: boolean | null
        }
        Update: {
          activity_type?: string
          blood_group?: string | null
          camp_id?: string | null
          camp_name?: string | null
          created_at?: string
          donor_name?: string | null
          hospital?: string | null
          id?: string
          patient_id?: string
          payload?: Json
          status?: string
          units?: number | null
          updated_at?: string
          urgent?: boolean | null
        }
        Relationships: []
      }
      blood_donation_camps: {
        Row: {
          area: string
          camp_date: string
          city: string
          created_at: string
          hospital: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          updated_at: string
        }
        Insert: {
          area: string
          camp_date: string
          city?: string
          created_at?: string
          hospital?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          area?: string
          camp_date?: string
          city?: string
          created_at?: string
          hospital?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      care_program_bookings: {
        Row: {
          created_at: string
          details: Json
          fee: number | null
          id: string
          patient_id: string
          program: string
          status: string
          summary: string | null
          tier: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: Json
          fee?: number | null
          id?: string
          patient_id: string
          program: string
          status?: string
          summary?: string | null
          tier?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: Json
          fee?: number | null
          id?: string
          patient_id?: string
          program?: string
          status?: string
          summary?: string | null
          tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      care_programs_catalog: {
        Row: {
          city: string
          code: string
          created_at: string
          description: string | null
          id: string
          monthly_fee: number | null
          name: string
          tier: string | null
          updated_at: string
        }
        Insert: {
          city?: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          monthly_fee?: number | null
          name: string
          tier?: string | null
          updated_at?: string
        }
        Update: {
          city?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          monthly_fee?: number | null
          name?: string
          tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      care_physician_profiles: {
        Row: {
          age_groups: string[]
          council_name: string | null
          council_registration_number: string | null
          created_at: string
          duty_types: string[]
          experience_years: number
          is_available: boolean
          preferred_areas: string[]
          preferred_hospitals: string[]
          procedures: string[]
          qualification: string
          registration_verified: boolean
          specialty_interests: string[]
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          age_groups?: string[]
          council_name?: string | null
          council_registration_number?: string | null
          created_at?: string
          duty_types?: string[]
          experience_years?: number
          is_available?: boolean
          preferred_areas?: string[]
          preferred_hospitals?: string[]
          procedures?: string[]
          qualification: string
          registration_verified?: boolean
          specialty_interests?: string[]
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          age_groups?: string[]
          council_name?: string | null
          council_registration_number?: string | null
          created_at?: string
          duty_types?: string[]
          experience_years?: number
          is_available?: boolean
          preferred_areas?: string[]
          preferred_hospitals?: string[]
          procedures?: string[]
          qualification?: string
          registration_verified?: boolean
          specialty_interests?: string[]
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_physician_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_requests: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          amount: number | null
          arrival_deadline: string | null
          cancel_reason: string | null
          cancel_reason_code: string | null
          cancelled_at: string | null
          chat_expires_at: string | null
          completed_at: string | null
          created_at: string
          emergency: boolean
          fare: number | null
          id: string
          lat: number | null
          lng: number | null
          my_doctor_id: string | null
          notes: string | null
          notification_stage: string | null
          otp: string | null
          otp_verified_at: string | null
          paid_at: string | null
          patient_id: string
          preferred_id: string | null
          rating_patient: number | null
          rating_patient_at: string | null
          rating_provider: number | null
          rating_provider_at: string | null
          specialty: string
          stage_started_at: string | null
          status: Database["public"]["Enums"]["care_status"]
          updated_at: string
          visit_type: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          amount?: number | null
          arrival_deadline?: string | null
          cancel_reason?: string | null
          cancel_reason_code?: string | null
          cancelled_at?: string | null
          chat_expires_at?: string | null
          completed_at?: string | null
          created_at?: string
          emergency?: boolean
          fare?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          my_doctor_id?: string | null
          notes?: string | null
          notification_stage?: string | null
          otp?: string | null
          otp_verified_at?: string | null
          paid_at?: string | null
          patient_id: string
          preferred_id?: string | null
          rating_patient?: number | null
          rating_patient_at?: string | null
          rating_provider?: number | null
          rating_provider_at?: string | null
          specialty: string
          stage_started_at?: string | null
          status?: Database["public"]["Enums"]["care_status"]
          updated_at?: string
          visit_type?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          amount?: number | null
          arrival_deadline?: string | null
          cancel_reason?: string | null
          cancel_reason_code?: string | null
          cancelled_at?: string | null
          chat_expires_at?: string | null
          completed_at?: string | null
          created_at?: string
          emergency?: boolean
          fare?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          my_doctor_id?: string | null
          notes?: string | null
          notification_stage?: string | null
          otp?: string | null
          otp_verified_at?: string | null
          paid_at?: string | null
          patient_id?: string
          preferred_id?: string | null
          rating_patient?: number | null
          rating_patient_at?: string | null
          rating_provider?: number | null
          rating_provider_at?: string | null
          specialty?: string
          stage_started_at?: string | null
          status?: Database["public"]["Enums"]["care_status"]
          updated_at?: string
          visit_type?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          recipient_id: string | null
          sender_id: string
          thread_key: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipient_id?: string | null
          sender_id: string
          thread_key: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipient_id?: string | null
          sender_id?: string
          thread_key?: string
        }
        Relationships: []
      }
      community_requests: {
        Row: {
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          notes: string | null
          payload: Json
          requester_id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payload?: Json
          requester_id: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payload?: Json
          requester_id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          booking_id: string
          booking_kind: string
          consent_type: string
          created_at: string
          document_text: string
          granted_at: string
          id: string
          ip: unknown
          policy_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          booking_id: string
          booking_kind: string
          consent_type: string
          created_at?: string
          document_text: string
          granted_at?: string
          id?: string
          ip?: unknown
          policy_version: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          booking_id?: string
          booking_kind?: string
          consent_type?: string
          created_at?: string
          document_text?: string
          granted_at?: string
          id?: string
          ip?: unknown
          policy_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coordinator_case_events: {
        Row: {
          actor_id: string | null
          case_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          note: string | null
        }
        Insert: {
          actor_id?: string | null
          case_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          note?: string | null
        }
        Update: {
          actor_id?: string | null
          case_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coordinator_case_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordinator_case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "coordinator_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      coordinator_case_tasks: {
        Row: {
          case_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          notes: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          due_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordinator_case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "coordinator_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordinator_case_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coordinator_cases: {
        Row: {
          assigned_coordinator_id: string | null
          closed_at: string | null
          created_at: string
          facility_id: string | null
          id: string
          patient_id: string
          priority: string
          request_type: string
          requested_by: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          assigned_coordinator_id?: string | null
          closed_at?: string | null
          created_at?: string
          facility_id?: string | null
          id?: string
          patient_id: string
          priority?: string
          request_type: string
          requested_by: string
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          assigned_coordinator_id?: string | null
          closed_at?: string | null
          created_at?: string
          facility_id?: string | null
          id?: string
          patient_id?: string
          priority?: string
          request_type?: string
          requested_by?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordinator_cases_assigned_coordinator_id_fkey"
            columns: ["assigned_coordinator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordinator_cases_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordinator_cases_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordinator_cases_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coordinator_profiles: {
        Row: {
          application_status: string
          availability_note: string | null
          created_at: string
          experience_years: number
          is_available: boolean
          languages: string[]
          qualifications: string | null
          service_area: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          application_status?: string
          availability_note?: string | null
          created_at?: string
          experience_years?: number
          is_available?: boolean
          languages?: string[]
          qualifications?: string | null
          service_area?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          application_status?: string
          availability_note?: string | null
          created_at?: string
          experience_years?: number
          is_available?: boolean
          languages?: string[]
          qualifications?: string | null
          service_area?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coordinator_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          device_id: string | null
          enabled: boolean
          id: string
          last_seen_at: string
          locale: string | null
          platform: string
          provider: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_id?: string | null
          enabled?: boolean
          id?: string
          last_seen_at?: string
          locale?: string | null
          platform: string
          provider?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_id?: string | null
          enabled?: boolean
          id?: string
          last_seen_at?: string
          locale?: string | null
          platform?: string
          provider?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      family_physician_plans: {
        Row: {
          cancelled_at: string | null
          chat_unlimited: boolean
          created_at: string
          doctor_id: string | null
          doctor_name: string
          doctor_spec: string | null
          expires_at: string
          family_lab_records: boolean
          free_consult_months: number
          id: string
          patient_id: string
          price: number
          purchased_at: string
          status: string
          updated_at: string
          video_call_interval_days: number
          voice_call_interval_days: number
        }
        Insert: {
          cancelled_at?: string | null
          chat_unlimited?: boolean
          created_at?: string
          doctor_id?: string | null
          doctor_name: string
          doctor_spec?: string | null
          expires_at?: string
          family_lab_records?: boolean
          free_consult_months?: number
          id?: string
          patient_id: string
          price?: number
          purchased_at?: string
          status?: string
          updated_at?: string
          video_call_interval_days?: number
          voice_call_interval_days?: number
        }
        Update: {
          cancelled_at?: string | null
          chat_unlimited?: boolean
          created_at?: string
          doctor_id?: string | null
          doctor_name?: string
          doctor_spec?: string | null
          expires_at?: string
          family_lab_records?: boolean
          free_consult_months?: number
          id?: string
          patient_id?: string
          price?: number
          purchased_at?: string
          status?: string
          updated_at?: string
          video_call_interval_days?: number
          voice_call_interval_days?: number
        }
        Relationships: []
      }
      family_plan_call_log: {
        Row: {
          call_type: string
          created_at: string
          doctor_id: string | null
          id: string
          patient_id: string
          plan_id: string
        }
        Insert: {
          call_type: string
          created_at?: string
          doctor_id?: string | null
          id?: string
          patient_id: string
          plan_id: string
        }
        Update: {
          call_type?: string
          created_at?: string
          doctor_id?: string | null
          id?: string
          patient_id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_plan_call_log_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "family_physician_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          created_at: string
          details: Json
          form_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          form_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          form_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          area: string
          city: string
          created_at: string
          emergency: boolean
          id: string
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          specialties: string[]
          updated_at: string
        }
        Insert: {
          area: string
          city?: string
          created_at?: string
          emergency?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          specialties?: string[]
          updated_at?: string
        }
        Update: {
          area?: string
          city?: string
          created_at?: string
          emergency?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          specialties?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      hub_beds: {
        Row: {
          hub_id: string
          id: string
          patient_id: string | null
          room_label: string
          status: string
          updated_at: string
        }
        Insert: {
          hub_id: string
          id?: string
          patient_id?: string | null
          room_label: string
          status?: string
          updated_at?: string
        }
        Update: {
          hub_id?: string
          id?: string
          patient_id?: string | null
          room_label?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_beds_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_favorite_providers: {
        Row: {
          category: string
          created_at: string
          hub_id: string
          id: string
          kind: string
          provider_id: string
          provider_name: string | null
          slot: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          hub_id: string
          id?: string
          kind: string
          provider_id: string
          provider_name?: string | null
          slot?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          hub_id?: string
          id?: string
          kind?: string
          provider_id?: string
          provider_name?: string | null
          slot?: number
          updated_at?: string
        }
        Relationships: []
      }
      hubs: {
        Row: {
          area: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          owner_id: string | null
        }
        Insert: {
          area?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          owner_id?: string | null
        }
        Update: {
          area?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          owner_id?: string | null
        }
        Relationships: []
      }
      medicine_orders: {
        Row: {
          address: string | null
          cold_chain: boolean
          created_at: string
          delivery_fee: number | null
          delivery_speed: string
          id: string
          items: Json
          items_total: number | null
          notes: string | null
          patient_id: string
          pharmacy_name: string
          prescription_attached: boolean
          repeat_monthly: boolean
          status: string
          total: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cold_chain?: boolean
          created_at?: string
          delivery_fee?: number | null
          delivery_speed: string
          id?: string
          items?: Json
          items_total?: number | null
          notes?: string | null
          patient_id: string
          pharmacy_name: string
          prescription_attached?: boolean
          repeat_monthly?: boolean
          status?: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cold_chain?: boolean
          created_at?: string
          delivery_fee?: number | null
          delivery_speed?: string
          id?: string
          items?: Json
          items_total?: number | null
          notes?: string | null
          patient_id?: string
          pharmacy_name?: string
          prescription_attached?: boolean
          repeat_monthly?: boolean
          status?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      mw_care_team_members: {
        Row: {
          appointment_at: string | null
          appointment_note: string | null
          created_at: string
          id: string
          provider_id: string | null
          provider_name: string | null
          required: boolean
          role: string
          role_label: string
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          appointment_at?: string | null
          appointment_note?: string | null
          created_at?: string
          id?: string
          provider_id?: string | null
          provider_name?: string | null
          required?: boolean
          role: string
          role_label: string
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          appointment_at?: string | null
          appointment_note?: string | null
          created_at?: string
          id?: string
          provider_id?: string | null
          provider_name?: string | null
          required?: boolean
          role?: string
          role_label?: string
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mw_care_team_members_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mw_care_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mw_care_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      mw_care_teams: {
        Row: {
          anchor_modality: string
          anchor_role: string | null
          anchor_summary: string | null
          assembled_at: string | null
          assembly_due_at: string
          assigned_coordinator_id: string | null
          booking_id: string | null
          coordination_fee: number | null
          coordination_fee_disclosed_at: string | null
          created_at: string
          first_contact_at: string | null
          first_contact_due_at: string
          id: string
          modality_reason: string | null
          patient_id: string
          programme_enrolled_at: string | null
          programme_tier: string | null
          review_flag: boolean
          screening_band: string | null
          screening_instrument: string | null
          screening_red_flag: boolean
          screening_score: number | null
          status: string
          track: string
          updated_at: string
          urgent: boolean
        }
        Insert: {
          anchor_modality?: string
          anchor_role?: string | null
          anchor_summary?: string | null
          assembled_at?: string | null
          assembly_due_at?: string
          assigned_coordinator_id?: string | null
          booking_id?: string | null
          coordination_fee?: number | null
          coordination_fee_disclosed_at?: string | null
          created_at?: string
          first_contact_at?: string | null
          first_contact_due_at?: string
          id?: string
          modality_reason?: string | null
          patient_id: string
          programme_enrolled_at?: string | null
          programme_tier?: string | null
          review_flag?: boolean
          screening_band?: string | null
          screening_instrument?: string | null
          screening_red_flag?: boolean
          screening_score?: number | null
          status?: string
          track: string
          updated_at?: string
          urgent?: boolean
        }
        Update: {
          anchor_modality?: string
          anchor_role?: string | null
          anchor_summary?: string | null
          assembled_at?: string | null
          assembly_due_at?: string
          assigned_coordinator_id?: string | null
          booking_id?: string | null
          coordination_fee?: number | null
          coordination_fee_disclosed_at?: string | null
          created_at?: string
          first_contact_at?: string | null
          first_contact_due_at?: string
          id?: string
          modality_reason?: string | null
          patient_id?: string
          programme_enrolled_at?: string | null
          programme_tier?: string | null
          review_flag?: boolean
          screening_band?: string | null
          screening_instrument?: string | null
          screening_red_flag?: boolean
          screening_score?: number | null
          status?: string
          track?: string
          updated_at?: string
          urgent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mw_care_teams_assigned_coordinator_id_fkey"
            columns: ["assigned_coordinator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mw_care_teams_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "care_program_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      mw_measurements: {
        Row: {
          band: string
          created_at: string
          id: string
          instrument: string
          patient_id: string
          recorded_by: string | null
          red_flag: boolean
          score: number
          taken_at: string
          team_id: string
        }
        Insert: {
          band: string
          created_at?: string
          id?: string
          instrument: string
          patient_id: string
          recorded_by?: string | null
          red_flag?: boolean
          score: number
          taken_at?: string
          team_id: string
        }
        Update: {
          band?: string
          created_at?: string
          id?: string
          instrument?: string
          patient_id?: string
          recorded_by?: string | null
          red_flag?: boolean
          score?: number
          taken_at?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mw_measurements_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mw_measurements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mw_care_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_favorite_medicos: {
        Row: {
          created_at: string
          id: string
          medico_id: string
          patient_id: string
          slot: string
          specialty: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          medico_id: string
          patient_id: string
          slot: string
          specialty: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          medico_id?: string
          patient_id?: string
          slot?: string
          specialty?: string
          updated_at?: string
        }
        Relationships: []
      }
      physician_duty_feedback: {
        Row: {
          assignment_id: string
          comment: string | null
          created_at: string
          facility_id: string
          facility_support: number | null
          id: string
          job_id: string
          provider_id: string
          rating: number
          updated_at: string
          workload: number | null
          would_work_again: boolean | null
        }
        Insert: {
          assignment_id: string
          comment?: string | null
          created_at?: string
          facility_id: string
          facility_support?: number | null
          id?: string
          job_id: string
          provider_id: string
          rating: number
          updated_at?: string
          workload?: number | null
          would_work_again?: boolean | null
        }
        Update: {
          assignment_id?: string
          comment?: string | null
          created_at?: string
          facility_id?: string
          facility_support?: number | null
          id?: string
          job_id?: string
          provider_id?: string
          rating?: number
          updated_at?: string
          workload?: number | null
          would_work_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "physician_duty_feedback_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "staffing_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physician_duty_feedback_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "staffing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      physio_partner_areas: {
        Row: {
          area: string
          city: string
          created_at: string
          id: string
          partner_id: string
        }
        Insert: {
          area: string
          city?: string
          created_at?: string
          id?: string
          partner_id: string
        }
        Update: {
          area?: string
          city?: string
          created_at?: string
          id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "physio_partner_areas_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "physio_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      physio_partners: {
        Row: {
          active: boolean
          city: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          city?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          city?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      physio_therapists: {
        Row: {
          active: boolean
          area: string | null
          city: string
          created_at: string
          full_name: string
          id: string
          partner_id: string | null
          phone: string | null
          registration_number: string | null
          specializations: string[]
          updated_at: string
          user_id: string | null
          verified: boolean
        }
        Insert: {
          active?: boolean
          area?: string | null
          city?: string
          created_at?: string
          full_name: string
          id?: string
          partner_id?: string | null
          phone?: string | null
          registration_number?: string | null
          specializations?: string[]
          updated_at?: string
          user_id?: string | null
          verified?: boolean
        }
        Update: {
          active?: boolean
          area?: string | null
          city?: string
          created_at?: string
          full_name?: string
          id?: string
          partner_id?: string | null
          phone?: string | null
          registration_number?: string | null
          specializations?: string[]
          updated_at?: string
          user_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "physio_therapists_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "physio_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      physio_visit_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          partner_id: string | null
          patient_id: string | null
          professionalism: number | null
          punctuality: number | null
          rating: number
          therapist_id: string | null
          updated_at: string
          visit_id: string
          would_rebook: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          partner_id?: string | null
          patient_id?: string | null
          professionalism?: number | null
          punctuality?: number | null
          rating: number
          therapist_id?: string | null
          updated_at?: string
          visit_id: string
          would_rebook?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          partner_id?: string | null
          patient_id?: string | null
          professionalism?: number | null
          punctuality?: number | null
          rating?: number
          therapist_id?: string | null
          updated_at?: string
          visit_id?: string
          would_rebook?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "physio_visit_feedback_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "physio_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_visit_feedback_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "physio_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_visit_feedback_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: true
            referencedRelation: "physio_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      physio_visits: {
        Row: {
          address: string | null
          area: string
          cancel_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          city: string
          created_at: string
          duration_min: number
          fee: number | null
          id: string
          lat: number | null
          lng: number | null
          no_show: boolean
          notes: string | null
          partner_id: string | null
          patient_id: string | null
          patient_name: string | null
          session_number: number
          status: string
          therapist_id: string | null
          therapy_type: string
          updated_at: string
          urgency: string
        }
        Insert: {
          address?: string | null
          area: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          city?: string
          created_at?: string
          duration_min?: number
          fee?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          no_show?: boolean
          notes?: string | null
          partner_id?: string | null
          patient_id?: string | null
          patient_name?: string | null
          session_number?: number
          status?: string
          therapist_id?: string | null
          therapy_type?: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          address?: string | null
          area?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          city?: string
          created_at?: string
          duration_min?: number
          fee?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          no_show?: boolean
          notes?: string | null
          partner_id?: string | null
          patient_id?: string | null
          patient_name?: string | null
          session_number?: number
          status?: string
          therapist_id?: string | null
          therapy_type?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "physio_visits_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "physio_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_visits_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "physio_therapists"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          hub_id: string | null
          id: string
          last_seen_at: string | null
          lat: number | null
          lng: number | null
          phone: string | null
          specialty: string | null
          updated_at: string
          view: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          hub_id?: string | null
          id: string
          last_seen_at?: string | null
          lat?: number | null
          lng?: number | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
          view?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          hub_id?: string | null
          id?: string
          last_seen_at?: string | null
          lat?: number | null
          lng?: number | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
          view?: string | null
        }
        Relationships: []
      }
      prosthetics_bookings: {
        Row: {
          category: string
          created_at: string
          fee: number | null
          id: string
          notes: string | null
          patient_id: string
          provider_name: string
          status: string
          subtype: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          fee?: number | null
          id?: string
          notes?: string | null
          patient_id: string
          provider_name: string
          status?: string
          subtype: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          fee?: number | null
          id?: string
          notes?: string | null
          patient_id?: string
          provider_name?: string
          status?: string
          subtype?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_availability: {
        Row: {
          blocked_dates: string[]
          created_at: string
          dnd_allow_emergency: boolean
          dnd_windows: Json
          is_online: boolean
          service_online: Json
          timezone: string
          updated_at: string
          user_id: string
          working_hours: Json
        }
        Insert: {
          blocked_dates?: string[]
          created_at?: string
          dnd_allow_emergency?: boolean
          dnd_windows?: Json
          is_online?: boolean
          service_online?: Json
          timezone?: string
          updated_at?: string
          user_id: string
          working_hours?: Json
        }
        Update: {
          blocked_dates?: string[]
          created_at?: string
          dnd_allow_emergency?: boolean
          dnd_windows?: Json
          is_online?: boolean
          service_online?: Json
          timezone?: string
          updated_at?: string
          user_id?: string
          working_hours?: Json
        }
        Relationships: []
      }
      provider_directory: {
        Row: {
          active_case_load: number
          area: string | null
          city: string
          created_at: string
          hospital: string | null
          id: string
          name: string
          phone: string | null
          rating: number | null
          registration_body: string | null
          registration_number: string | null
          specialty: string
          updated_at: string
          verified: boolean
          years_experience: number | null
        }
        Insert: {
          active_case_load?: number
          area?: string | null
          city?: string
          created_at?: string
          hospital?: string | null
          id?: string
          name: string
          phone?: string | null
          rating?: number | null
          registration_body?: string | null
          registration_number?: string | null
          specialty: string
          updated_at?: string
          verified?: boolean
          years_experience?: number | null
        }
        Update: {
          active_case_load?: number
          area?: string | null
          city?: string
          created_at?: string
          hospital?: string | null
          id?: string
          name?: string
          phone?: string | null
          rating?: number | null
          registration_body?: string | null
          registration_number?: string | null
          specialty?: string
          updated_at?: string
          verified?: boolean
          years_experience?: number | null
        }
        Relationships: []
      }
      push_deliveries: {
        Row: {
          body: string
          created_at: string
          data: Json
          device_token_id: string | null
          error: string | null
          id: string
          provider_message_id: string | null
          status: string
          title: string
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          device_token_id?: string | null
          error?: string | null
          id?: string
          provider_message_id?: string | null
          status?: string
          title: string
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          device_token_id?: string | null
          error?: string | null
          id?: string
          provider_message_id?: string | null
          status?: string
          title?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_deliveries_device_token_id_fkey"
            columns: ["device_token_id"]
            isOneToOne: false
            referencedRelation: "device_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      request_audit_log: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          booking_id: string | null
          booking_role_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          note: string | null
          request_id: string | null
          stage: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          booking_id?: string | null
          booking_role_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          note?: string | null
          request_id?: string | null
          stage?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          booking_id?: string | null
          booking_role_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          note?: string | null
          request_id?: string | null
          stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_audit_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "care_request_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_audit_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "care_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: string
          payload: Json | null
          request_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json | null
          request_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "care_request_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "care_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_referrals: {
        Row: {
          care_request_id: string | null
          created_at: string
          doctor_id: string
          id: string
          note: string | null
          patient_id: string
          service_key: string
          service_label: string
          service_tab: string | null
          status: string
          updated_at: string
        }
        Insert: {
          care_request_id?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          note?: string | null
          patient_id: string
          service_key: string
          service_label: string
          service_tab?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          care_request_id?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          note?: string | null
          patient_id?: string
          service_key?: string
          service_label?: string
          service_tab?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      special_needs_bookings: {
        Row: {
          category: string
          created_at: string
          fee: number | null
          id: string
          notes: string | null
          patient_id: string
          provider_name: string
          status: string
          subtype: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          fee?: number | null
          id?: string
          notes?: string | null
          patient_id: string
          provider_name: string
          status?: string
          subtype: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          fee?: number | null
          id?: string
          notes?: string | null
          patient_id?: string
          provider_name?: string
          status?: string
          subtype?: string
          updated_at?: string
        }
        Relationships: []
      }
      specialty_care_bookings: {
        Row: {
          concern: string
          concern_id: string | null
          created_at: string
          id: string
          mode: string
          notes: string | null
          patient_id: string
          photo_attached: boolean | null
          price_high: number | null
          price_low: number | null
          provider_name: string
          specialty: string
          specialty_label: string
          status: string
          updated_at: string
        }
        Insert: {
          concern: string
          concern_id?: string | null
          created_at?: string
          id?: string
          mode: string
          notes?: string | null
          patient_id: string
          photo_attached?: boolean | null
          price_high?: number | null
          price_low?: number | null
          provider_name: string
          specialty: string
          specialty_label: string
          status?: string
          updated_at?: string
        }
        Update: {
          concern?: string
          concern_id?: string | null
          created_at?: string
          id?: string
          mode?: string
          notes?: string | null
          patient_id?: string
          photo_attached?: boolean | null
          price_high?: number | null
          price_low?: number | null
          provider_name?: string
          specialty?: string
          specialty_label?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      staffing_assignments: {
        Row: {
          accepted_at: string | null
          application_note: string | null
          applied_at: string
          cancel_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          completed_at: string | null
          created_at: string
          duty_type: string | null
          id: string
          job_id: string
          no_show: boolean
          provider_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          application_note?: string | null
          applied_at?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          completed_at?: string | null
          created_at?: string
          duty_type?: string | null
          id?: string
          job_id: string
          no_show?: boolean
          provider_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          application_note?: string | null
          applied_at?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          completed_at?: string | null
          created_at?: string
          duty_type?: string | null
          id?: string
          job_id?: string
          no_show?: boolean
          provider_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "staffing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_assignments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_feedback: {
        Row: {
          assignment_id: string
          comment: string | null
          created_at: string
          facility_id: string
          id: string
          job_id: string
          professionalism: number | null
          provider_id: string
          punctuality: number | null
          rating: number
          updated_at: string
          would_rehire: boolean | null
        }
        Insert: {
          assignment_id: string
          comment?: string | null
          created_at?: string
          facility_id: string
          id?: string
          job_id: string
          professionalism?: number | null
          provider_id: string
          punctuality?: number | null
          rating: number
          updated_at?: string
          would_rehire?: boolean | null
        }
        Update: {
          assignment_id?: string
          comment?: string | null
          created_at?: string
          facility_id?: string
          id?: string
          job_id?: string
          professionalism?: number | null
          provider_id?: string
          punctuality?: number | null
          rating?: number
          updated_at?: string
          would_rehire?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "staffing_feedback_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "staffing_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_feedback_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_feedback_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "staffing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_feedback_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_jobs: {
        Row: {
          area: string | null
          capacity: number
          compensation: number | null
          compensation_unit: string | null
          created_at: string
          description: string | null
          duty_type: string
          ends_at: string | null
          experience_years: number
          facility_id: string
          id: string
          job_type: string
          lat: number | null
          lng: number | null
          qualification: string | null
          required_procedures: string[]
          shift_label: string | null
          specialty: string
          starts_at: string | null
          status: string
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          area?: string | null
          capacity?: number
          compensation?: number | null
          compensation_unit?: string | null
          created_at?: string
          description?: string | null
          duty_type?: string
          ends_at?: string | null
          experience_years?: number
          facility_id: string
          id?: string
          job_type: string
          lat?: number | null
          lng?: number | null
          qualification?: string | null
          required_procedures?: string[]
          shift_label?: string | null
          specialty: string
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          area?: string | null
          capacity?: number
          compensation?: number | null
          compensation_unit?: string | null
          created_at?: string
          description?: string | null
          duty_type?: string
          ends_at?: string | null
          experience_years?: number
          facility_id?: string
          id?: string
          job_type?: string
          lat?: number | null
          lng?: number | null
          qualification?: string | null
          required_procedures?: string[]
          shift_label?: string | null
          specialty?: string
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_jobs_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      surgery_booking_roles: {
        Row: {
          accepted_at: string | null
          arrival_deadline: string | null
          assigned_to: string | null
          booking_id: string
          chat_expires_at: string | null
          completed_at: string | null
          created_at: string
          fee: number | null
          id: string
          notification_stage: string
          otp: string | null
          otp_verified_at: string | null
          paid_at: string | null
          rating_hub: number | null
          rating_hub_at: string | null
          rating_provider: number | null
          rating_provider_at: string | null
          role: string
          specialty: string | null
          stage_expires_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          arrival_deadline?: string | null
          assigned_to?: string | null
          booking_id: string
          chat_expires_at?: string | null
          completed_at?: string | null
          created_at?: string
          fee?: number | null
          id?: string
          notification_stage?: string
          otp?: string | null
          otp_verified_at?: string | null
          paid_at?: string | null
          rating_hub?: number | null
          rating_hub_at?: string | null
          rating_provider?: number | null
          rating_provider_at?: string | null
          role: string
          specialty?: string | null
          stage_expires_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          arrival_deadline?: string | null
          assigned_to?: string | null
          booking_id?: string
          chat_expires_at?: string | null
          completed_at?: string | null
          created_at?: string
          fee?: number | null
          id?: string
          notification_stage?: string
          otp?: string | null
          otp_verified_at?: string | null
          paid_at?: string | null
          rating_hub?: number | null
          rating_hub_at?: string | null
          rating_provider?: number | null
          rating_provider_at?: string | null
          role?: string
          specialty?: string | null
          stage_expires_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surgery_booking_roles_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "surgery_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      surgery_bookings: {
        Row: {
          blood_group: string | null
          blood_units: number | null
          created_at: string
          facility_id: string
          id: string
          mode: string
          notes: string | null
          ot_room: string | null
          patient_name: string
          patient_phone: string | null
          procedure: string
          status: string
          updated_at: string
        }
        Insert: {
          blood_group?: string | null
          blood_units?: number | null
          created_at?: string
          facility_id: string
          id?: string
          mode?: string
          notes?: string | null
          ot_room?: string | null
          patient_name: string
          patient_phone?: string | null
          procedure: string
          status?: string
          updated_at?: string
        }
        Update: {
          blood_group?: string | null
          blood_units?: number | null
          created_at?: string
          facility_id?: string
          id?: string
          mode?: string
          notes?: string | null
          ot_room?: string | null
          patient_name?: string
          patient_phone?: string | null
          procedure?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      care_request_notes: {
        Row: {
          id: string | null
          notes: string | null
        }
        Insert: {
          id?: string | null
          notes?: string | null
        }
        Update: {
          id?: string | null
          notes?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
        cancel_appointment: {
          Args: {
            p_appointment_id: string
          }
          Returns: void
        }
        reschedule_appointment: {
          Args: {
            p_appointment_id: string
            p_new_start: string
            p_new_end: string
          }
          Returns: void
        }
      claim_staffing_job: {
        Args: { _job_id: string }
        Returns: {
          assignment_id: string
          assignment_status: string
        }[]
      }
      check_family_plan_call_entitlement: {
        Args: { _call_type: string; _plan_id: string }
        Returns: Json
      }
      find_provider_user_id_by_name: {
        Args: { _name: string }
        Returns: string
      }
      get_active_family_plan: {
        Args: { _patient_id: string }
        Returns: {
          cancelled_at: string | null
          chat_unlimited: boolean
          created_at: string
          doctor_id: string | null
          doctor_name: string
          doctor_spec: string | null
          expires_at: string
          family_lab_records: boolean
          free_consult_months: number
          id: string
          patient_id: string
          price: number
          purchased_at: string
          status: string
          updated_at: string
          video_call_interval_days: number
          voice_call_interval_days: number
        }
        SetofOptions: {
          from: "*"
          to: "family_physician_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_coordinator: { Args: { _user_id: string }; Returns: boolean }
      is_admin_user: { Args: never; Returns: boolean }
      is_hub_surgery_preferred: {
        Args: { _hub_id: string; _provider_id: string; _role: string }
        Returns: boolean
      }
      is_provider_available: {
        Args: { _at?: string; _specialty: string; _uid: string }
        Returns: boolean
      }
      is_provider_in_dnd: {
        Args: { _at?: string; _uid: string }
        Returns: boolean
      }
      my_physio_partner_id: { Args: never; Returns: string }
      physio_partner_covers_area: {
        Args: { _area: string; _partner_id: string }
        Returns: boolean
      }
      provider_matches_surgery_role: {
        Args: { _role: string; _uid: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "patient" | "provider" | "facility" | "admin" | "super_admin"
      care_status: "open" | "accepted" | "completed" | "cancelled" | "failed"
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
    Enums: {
      app_role: ["patient", "provider", "facility", "admin", "super_admin"],
      care_status: ["open", "accepted", "completed", "cancelled", "failed"],
    },
  },
} as const
