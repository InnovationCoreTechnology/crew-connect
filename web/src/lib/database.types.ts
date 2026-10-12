// GENERATED from the live database schema (Supabase MCP generate_typescript_types, project qehkkituvqaishysoqta,
// 2026-10-11, admin_overview added 2026-10-12 from a fresh generation). Do NOT edit by hand. Regenerate after every migration (see supabase/README.md) so the compiler
// catches any mismatch between the database and web/src/data/api.ts.
// Trimmed: the generic helper types (Tables, Enums, ...) were removed because nothing uses them.
//
// KNOWN GAP in the generator: functions that RETURN TABLE are typed with non-null columns. In reality
// search_candidates().phone is null until the employer unlocks the candidate. api.ts treats it as nullable.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: { key: string; value: number }
        Insert: { key: string; value: number }
        Update: { key?: string; value?: number }
        Relationships: []
      }
      applications: {
        Row: { candidate_id: string; created_at: string; job_id: string; status: string }
        Insert: { candidate_id: string; created_at?: string; job_id: string; status?: string }
        Update: { candidate_id?: string; created_at?: string; job_id?: string; status?: string }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          area: string
          avail: string
          blocked: boolean
          created_at: string
          exp: number
          id: string
          name: string
          phone_masked: string
          salary: number
          shift: string
          type: string
          verified: boolean
          visible: boolean | null
        }
        Insert: {
          area?: string
          avail?: string
          blocked?: boolean
          created_at?: string
          exp?: number
          id: string
          name?: string
          phone_masked: string
          salary?: number
          shift?: string
          type?: string
          verified?: boolean
          visible?: boolean | null
        }
        Update: {
          area?: string
          avail?: string
          blocked?: boolean
          created_at?: string
          exp?: number
          id?: string
          name?: string
          phone_masked?: string
          salary?: number
          shift?: string
          type?: string
          verified?: boolean
          visible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employers: {
        Row: { company_name: string; created_at: string; free_unlocks_left: number; id: string; status: string }
        Insert: { company_name?: string; created_at?: string; free_unlocks_left?: number; id: string; status?: string }
        Update: { company_name?: string; created_at?: string; free_unlocks_left?: number; id?: string; status?: string }
        Relationships: [
          {
            foreignKeyName: "employers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          area: string
          created_at: string
          employer_id: string
          id: string
          openings: number
          salary: number
          shift: string
          title: string
          type: string
        }
        Insert: {
          area: string
          created_at?: string
          employer_id: string
          id?: string
          openings: number
          salary: number
          shift: string
          title: string
          type: string
        }
        Update: {
          area?: string
          created_at?: string
          employer_id?: string
          id?: string
          openings?: number
          salary?: number
          shift?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: { created_at: string; id: string; phone: string; role: string }
        Insert: { created_at?: string; id: string; phone: string; role: string }
        Update: { created_at?: string; id?: string; phone?: string; role?: string }
        Relationships: []
      }
      unlocks: {
        Row: { candidate_id: string; created_at: string; employer_id: string }
        Insert: { candidate_id: string; created_at?: string; employer_id: string }
        Update: { candidate_id?: string; created_at?: string; employer_id?: string }
        Relationships: [
          {
            foreignKeyName: "unlocks_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlocks_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          amount_inr: number
          candidate_id: string | null
          created_at: string
          employer_id: string
          id: number
          reason: string
        }
        Insert: {
          amount_inr: number
          candidate_id?: string | null
          created_at?: string
          employer_id: string
          id?: never
          reason: string
        }
        Update: {
          amount_inr?: number
          candidate_id?: string | null
          created_at?: string
          employer_id?: string
          id?: never
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_candidates: {
        Args: never
        Returns: {
          area: string
          avail: string
          blocked: boolean
          created_at: string
          exp: number
          id: string
          name: string
          phone: string
          salary: number
          shift: string
          type: string
          verified: boolean
        }[]
      }
      admin_list_employers: {
        Args: never
        Returns: {
          company_name: string
          created_at: string
          free_unlocks_left: number
          id: string
          phone: string
          spent_inr: number
          status: string
        }[]
      }
      admin_overview: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          applications_new: number
          applications_total: number
          candidates_new: number
          candidates_total: number
          candidates_visible: number
          employers_approved: number
          employers_blocked: number
          employers_new: number
          employers_pending: number
          employers_total: number
          jobs_new: number
          jobs_total: number
          revenue_range_inr: number
          revenue_total_inr: number
          unlocks_new: number
          unlocks_total: number
        }[]
      }
      admin_set_candidate_flag: {
        Args: { p_flag: string; p_id: string; p_value: boolean }
        Returns: undefined
      }
      admin_set_employer_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      admin_stats: {
        Args: never
        Returns: {
          candidates_count: number
          employers_count: number
          jobs_count: number
          pending_employers_count: number
          revenue_inr: number
          unlocks_count: number
        }[]
      }
      apply_to_job: { Args: { p_job_id: string }; Returns: undefined }
      get_my_employer: {
        Args: never
        Returns: {
          company_name: string
          free_unlocks_left: number
          id: string
          spent_inr: number
          status: string
          unlocked_count: number
        }[]
      }
      list_jobs: {
        Args: { p_type?: string }
        Returns: {
          area: string
          company_name: string
          created_at: string
          id: string
          openings: number
          salary: number
          shift: string
          title: string
          type: string
        }[]
      }
      list_my_applications: {
        Args: never
        Returns: {
          applied_at: string
          area: string
          company_name: string
          id: string
          openings: number
          salary: number
          shift: string
          status: string
          title: string
          type: string
        }[]
      }
      list_unlocked: {
        Args: {
          p_after_created_at?: string
          p_after_id?: string
          p_limit?: number
        }
        Returns: {
          area: string
          avail: string
          created_at: string
          exp: number
          id: string
          name: string
          phone: string
          phone_masked: string
          salary: number
          shift: string
          type: string
          unlocked: boolean
          verified: boolean
        }[]
      }
      register_account: { Args: { p_role: string }; Returns: undefined }
      search_candidates: {
        Args: {
          p_after_created_at?: string
          p_after_id?: string
          p_area?: string
          p_limit?: number
          p_max_salary?: number
          p_min_exp?: number
          p_query?: string
          p_shift?: string
          p_type?: string
          p_verified_only?: boolean
        }
        Returns: {
          area: string
          avail: string
          created_at: string
          exp: number
          id: string
          name: string
          phone: string
          phone_masked: string
          salary: number
          shift: string
          type: string
          unlocked: boolean
          verified: boolean
        }[]
      }
      unlock_candidate: {
        Args: { p_candidate_id: string }
        Returns: {
          charged: boolean
          free_unlocks_left: number
          phone: string
          spent_inr: number
          unlocked_count: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
