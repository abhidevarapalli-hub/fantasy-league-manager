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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cricket_matches: {
        Row: {
          city: string | null
          created_at: string | null
          cricbuzz_match_id: number
          id: string
          man_of_match_id: string | null
          man_of_match_name: string | null
          match_date: string | null
          match_description: string | null
          match_format: string | null
          match_week: number | null
          result: string | null
          series_id: number
          state: string | null
          team1_id: number | null
          team1_name: string | null
          team1_score: string | null
          team1_short: string | null
          team2_id: number | null
          team2_name: string | null
          team2_score: string | null
          team2_short: string | null
          venue: string | null
          winner_team_id: number | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          cricbuzz_match_id: number
          id?: string
          man_of_match_id?: string | null
          man_of_match_name?: string | null
          match_date?: string | null
          match_description?: string | null
          match_format?: string | null
          match_week?: number | null
          result?: string | null
          series_id: number
          state?: string | null
          team1_id?: number | null
          team1_name?: string | null
          team1_score?: string | null
          team1_short?: string | null
          team2_id?: number | null
          team2_name?: string | null
          team2_score?: string | null
          team2_short?: string | null
          venue?: string | null
          winner_team_id?: number | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          cricbuzz_match_id?: number
          id?: string
          man_of_match_id?: string | null
          man_of_match_name?: string | null
          match_date?: string | null
          match_description?: string | null
          match_format?: string | null
          match_week?: number | null
          result?: string | null
          series_id?: number
          state?: string | null
          team1_id?: number | null
          team1_name?: string | null
          team1_score?: string | null
          team1_short?: string | null
          team2_id?: number | null
          team2_name?: string | null
          team2_score?: string | null
          team2_short?: string | null
          venue?: string | null
          winner_team_id?: number | null
        }
        Relationships: []
      }
      draft_order: {
        Row: {
          auto_draft_enabled: boolean | null
          created_at: string
          id: string
          league_id: string
          manager_id: string | null
          position: number
        }
        Insert: {
          auto_draft_enabled?: boolean | null
          created_at?: string
          id?: string
          league_id: string
          manager_id?: string | null
          position: number
        }
        Update: {
          auto_draft_enabled?: boolean | null
          created_at?: string
          id?: string
          league_id?: string
          manager_id?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "draft_order_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_order_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_picks: {
        Row: {
          created_at: string
          id: string
          is_auto_draft: boolean | null
          league_id: string
          manager_id: string | null
          pick_position: number
          player_id: string | null
          round: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_auto_draft?: boolean | null
          league_id: string
          manager_id?: string | null
          pick_position: number
          player_id?: string | null
          round: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_auto_draft?: boolean | null
          league_id?: string
          manager_id?: string | null
          pick_position?: number
          player_id?: string | null
          round?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_picks_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "league_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "master_players"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_state: {
        Row: {
          created_at: string
          current_pick_start_at: string | null
          finalized_at: string | null
          id: string
          is_active: boolean | null
          is_finalized: boolean
          league_id: string
          paused_at: string | null
        }
        Insert: {
          created_at?: string
          current_pick_start_at?: string | null
          finalized_at?: string | null
          id?: string
          is_active?: boolean | null
          is_finalized?: boolean
          league_id: string
          paused_at?: string | null
        }
        Update: {
          created_at?: string
          current_pick_start_at?: string | null
          finalized_at?: string | null
          id?: string
          is_active?: boolean | null
          is_finalized?: boolean
          league_id?: string
          paused_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_state_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_matches: {
        Row: {
          created_at: string | null
          id: string
          league_id: string
          match_id: string
          stats_imported: boolean | null
          stats_imported_at: string | null
          week: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          league_id: string
          match_id: string
          stats_imported?: boolean | null
          stats_imported_at?: string | null
          week?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          league_id?: string
          match_id?: string
          stats_imported?: boolean | null
          stats_imported_at?: string | null
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_matches_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_matches_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "cricket_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_matches_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "league_cricket_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      league_player_match_scores: {
        Row: {
          batting_points: number
          bowling_points: number
          common_points: number
          computed_at: string
          fielding_points: number
          finalized_at: string | null
          id: string
          is_live: boolean
          league_id: string
          manager_id: string | null
          match_id: string
          match_player_stats_id: string
          player_id: string
          points_breakdown: Json
          total_points: number
          was_in_active_roster: boolean
          week: number | null
        }
        Insert: {
          batting_points?: number
          bowling_points?: number
          common_points?: number
          computed_at?: string
          fielding_points?: number
          finalized_at?: string | null
          id?: string
          is_live?: boolean
          league_id: string
          manager_id?: string | null
          match_id: string
          match_player_stats_id: string
          player_id: string
          points_breakdown?: Json
          total_points?: number
          was_in_active_roster?: boolean
          week?: number | null
        }
        Update: {
          batting_points?: number
          bowling_points?: number
          common_points?: number
          computed_at?: string
          fielding_points?: number
          finalized_at?: string | null
          id?: string
          is_live?: boolean
          league_id?: string
          manager_id?: string | null
          match_id?: string
          match_player_stats_id?: string
          player_id?: string
          points_breakdown?: Json
          total_points?: number
          was_in_active_roster?: boolean
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_player_match_scores_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_player_match_scores_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_player_match_scores_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "cricket_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_player_match_scores_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "league_cricket_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_player_match_scores_match_player_stats_id_fkey"
            columns: ["match_player_stats_id"]
            isOneToOne: false
            referencedRelation: "match_player_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_player_match_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "league_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_player_match_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "master_players"
            referencedColumns: ["id"]
          },
        ]
      }
      league_player_pool: {
        Row: {
          created_at: string | null
          id: string
          is_available: boolean | null
          league_id: string
          player_id: string
          status: Database["public"]["Enums"]["player_availability"] | null
          team_override: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          league_id: string
          player_id: string
          status?: Database["public"]["Enums"]["player_availability"] | null
          team_override?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          league_id?: string
          player_id?: string
          status?: Database["public"]["Enums"]["player_availability"] | null
          team_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "league_player_pool_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_player_pool_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "league_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_player_pool_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "master_players"
            referencedColumns: ["id"]
          },
        ]
      }
      league_schedules: {
        Row: {
          created_at: string | null
          id: string
          is_finalized: boolean
          league_id: string
          manager1_id: string
          manager1_score: number | null
          manager2_id: string | null
          manager2_score: number | null
          week: number
          winner_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_finalized?: boolean
          league_id: string
          manager1_id: string
          manager1_score?: number | null
          manager2_id?: string | null
          manager2_score?: number | null
          week: number
          winner_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_finalized?: boolean
          league_id?: string
          manager1_id?: string
          manager1_score?: number | null
          manager2_id?: string | null
          manager2_score?: number | null
          week?: number
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "league_schedules_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_schedules_manager1_id_fkey"
            columns: ["manager1_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_schedules_manager2_id_fkey"
            columns: ["manager2_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_schedules_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          active_size: number
          bench_size: number
          created_at: string
          id: string
          league_manager_id: string | null
          manager_count: number
          max_batsmen: number
          max_international: number
          min_all_rounders: number
          min_batsmen: number
          min_bowlers: number
          min_wks: number
          name: string
          tournament_id: number | null
          tournament_name: string | null
          updated_at: string
        }
        Insert: {
          active_size?: number
          bench_size?: number
          created_at?: string
          id?: string
          league_manager_id?: string | null
          manager_count?: number
          max_batsmen?: number
          max_international?: number
          min_all_rounders?: number
          min_batsmen?: number
          min_bowlers?: number
          min_wks?: number
          name: string
          tournament_id?: number | null
          tournament_name?: string | null
          updated_at?: string
        }
        Update: {
          active_size?: number
          bench_size?: number
          created_at?: string
          id?: string
          league_manager_id?: string | null
          manager_count?: number
          max_batsmen?: number
          max_international?: number
          min_all_rounders?: number
          min_batsmen?: number
          min_bowlers?: number
          min_wks?: number
          name?: string
          tournament_id?: number | null
          tournament_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lifecycle_audit_log: {
        Row: {
          duration_ms: number | null
          errors: string | null
          id: string
          matches_activated: number | null
          matches_checked: number | null
          run_at: string | null
        }
        Insert: {
          duration_ms?: number | null
          errors?: string | null
          id?: string
          matches_activated?: number | null
          matches_checked?: number | null
          run_at?: string | null
        }
        Update: {
          duration_ms?: number | null
          errors?: string | null
          id?: string
          matches_activated?: number | null
          matches_checked?: number | null
          run_at?: string | null
        }
        Relationships: []
      }
      live_match_polling: {
        Row: {
          auto_enabled: boolean | null
          circuit_opened_at: string | null
          circuit_state: string
          consecutive_errors: number
          created_at: string | null
          cricbuzz_match_id: number
          error_count: number | null
          id: string
          last_error: string | null
          last_polled_at: string | null
          match_id: string
          match_state: string | null
          next_poll_due_at: string | null
          poll_count: number | null
          poll_interval_secs: number
          poll_version: number
          polling_enabled: boolean | null
          polling_lock_until: string | null
          updated_at: string | null
        }
        Insert: {
          auto_enabled?: boolean | null
          circuit_opened_at?: string | null
          circuit_state?: string
          consecutive_errors?: number
          created_at?: string | null
          cricbuzz_match_id: number
          error_count?: number | null
          id?: string
          last_error?: string | null
          last_polled_at?: string | null
          match_id: string
          match_state?: string | null
          next_poll_due_at?: string | null
          poll_count?: number | null
          poll_interval_secs?: number
          poll_version?: number
          polling_enabled?: boolean | null
          polling_lock_until?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_enabled?: boolean | null
          circuit_opened_at?: string | null
          circuit_state?: string
          consecutive_errors?: number
          created_at?: string | null
          cricbuzz_match_id?: number
          error_count?: number | null
          id?: string
          last_error?: string | null
          last_polled_at?: string | null
          match_id?: string
          match_state?: string | null
          next_poll_due_at?: string | null
          poll_count?: number | null
          poll_interval_secs?: number
          poll_version?: number
          polling_enabled?: boolean | null
          polling_lock_until?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_match_polling_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "cricket_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_match_polling_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "league_cricket_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_roster: {
        Row: {
          created_at: string | null
          id: string
          league_id: string
          manager_id: string
          player_id: string
          position: number
          slot_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          league_id: string
          manager_id: string
          player_id: string
          position?: number
          slot_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          league_id?: string
          manager_id?: string
          player_id?: string
          position?: number
          slot_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_roster_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_roster_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_roster_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "league_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_roster_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "master_players"
            referencedColumns: ["id"]
          },
        ]
      }
      managers: {
        Row: {
          created_at: string
          id: string
          is_league_manager: boolean | null
          league_id: string
          losses: number
          name: string
          points: number
          team_name: string
          user_id: string | null
          wins: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_league_manager?: boolean | null
          league_id: string
          losses?: number
          name: string
          points?: number
          team_name: string
          user_id?: string | null
          wins?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_league_manager?: boolean | null
          league_id?: string
          losses?: number
          name?: string
          points?: number
          team_name?: string
          user_id?: string | null
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "managers_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      master_players: {
        Row: {
          batting_style: string | null
          bio: string | null
          birth_place: string | null
          bowling_style: string | null
          created_at: string | null
          cricbuzz_id: string | null
          dob: string | null
          height: string | null
          id: string
          image_id: number | null
          is_international: boolean | null
          name: string
          primary_role: string
          teams: string[] | null
          updated_at: string | null
        }
        Insert: {
          batting_style?: string | null
          bio?: string | null
          birth_place?: string | null
          bowling_style?: string | null
          created_at?: string | null
          cricbuzz_id?: string | null
          dob?: string | null
          height?: string | null
          id?: string
          image_id?: number | null
          is_international?: boolean | null
          name: string
          primary_role: string
          teams?: string[] | null
          updated_at?: string | null
        }
        Update: {
          batting_style?: string | null
          bio?: string | null
          birth_place?: string | null
          bowling_style?: string | null
          created_at?: string | null
          cricbuzz_id?: string | null
          dob?: string | null
          height?: string | null
          id?: string
          image_id?: number | null
          is_international?: boolean | null
          name?: string
          primary_role?: string
          teams?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      match_player_stats: {
        Row: {
          balls_faced: number | null
          batting_position: number | null
          catches: number | null
          created_at: string | null
          cricbuzz_player_id: string
          dismissal_type: string | null
          dots: number | null
          economy: number | null
          finalized_at: string | null
          fours: number | null
          id: string
          is_impact_player: boolean | null
          is_in_playing_11: boolean | null
          is_live: boolean | null
          is_man_of_match: boolean | null
          is_out: boolean | null
          lbw_bowled_count: number | null
          live_updated_at: string | null
          maidens: number | null
          match_id: string
          no_balls: number | null
          overs: number | null
          player_id: string | null
          run_outs: number | null
          runs: number | null
          runs_conceded: number | null
          sixes: number | null
          source_poll_version: number | null
          strike_rate: number | null
          stumpings: number | null
          team_won: boolean | null
          updated_at: string | null
          wickets: number | null
          wides: number | null
        }
        Insert: {
          balls_faced?: number | null
          batting_position?: number | null
          catches?: number | null
          created_at?: string | null
          cricbuzz_player_id: string
          dismissal_type?: string | null
          dots?: number | null
          economy?: number | null
          finalized_at?: string | null
          fours?: number | null
          id?: string
          is_impact_player?: boolean | null
          is_in_playing_11?: boolean | null
          is_live?: boolean | null
          is_man_of_match?: boolean | null
          is_out?: boolean | null
          lbw_bowled_count?: number | null
          live_updated_at?: string | null
          maidens?: number | null
          match_id: string
          no_balls?: number | null
          overs?: number | null
          player_id?: string | null
          run_outs?: number | null
          runs?: number | null
          runs_conceded?: number | null
          sixes?: number | null
          source_poll_version?: number | null
          strike_rate?: number | null
          stumpings?: number | null
          team_won?: boolean | null
          updated_at?: string | null
          wickets?: number | null
          wides?: number | null
        }
        Update: {
          balls_faced?: number | null
          batting_position?: number | null
          catches?: number | null
          created_at?: string | null
          cricbuzz_player_id?: string
          dismissal_type?: string | null
          dots?: number | null
          economy?: number | null
          finalized_at?: string | null
          fours?: number | null
          id?: string
          is_impact_player?: boolean | null
          is_in_playing_11?: boolean | null
          is_live?: boolean | null
          is_man_of_match?: boolean | null
          is_out?: boolean | null
          lbw_bowled_count?: number | null
          live_updated_at?: string | null
          maidens?: number | null
          match_id?: string
          no_balls?: number | null
          overs?: number | null
          player_id?: string | null
          run_outs?: number | null
          runs?: number | null
          runs_conceded?: number | null
          sixes?: number | null
          source_poll_version?: number | null
          strike_rate?: number | null
          stumpings?: number | null
          team_won?: boolean | null
          updated_at?: string | null
          wickets?: number | null
          wides?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_player_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "cricket_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "league_cricket_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "league_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "master_players"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      scoring_rules: {
        Row: {
          created_at: string | null
          id: string
          league_id: string
          rules: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          league_id: string
          rules?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          league_id?: string
          rules?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_players: {
        Row: {
          created_at: string | null
          id: string
          player_id: string
          side: string
          trade_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          player_id: string
          side: string
          trade_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          player_id?: string
          side?: string
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "league_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "master_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_players_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          created_at: string
          id: string
          league_id: string
          parent_trade_id: string | null
          proposer_id: string
          status: string
          target_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          parent_trade_id?: string | null
          proposer_id: string
          status?: string
          target_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          parent_trade_id?: string | null
          proposer_id?: string
          status?: string
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_parent_trade_id_fkey"
            columns: ["parent_trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_proposer_id_fkey"
            columns: ["proposer_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          created_at: string
          description: string
          id: string
          league_id: string | null
          manager_id: string | null
          players: Json | null
          type: string
          week: number | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          league_id?: string | null
          manager_id?: string | null
          players?: Json | null
          type: string
          week?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          league_id?: string | null
          manager_id?: string | null
          players?: Json | null
          type?: string
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fantasy_weekly_summary: {
        Row: {
          active_points: number | null
          bench_points: number | null
          league_id: string | null
          manager_id: string | null
          manager_name: string | null
          players_with_stats: number | null
          team_name: string | null
          total_points: number | null
          week: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_player_match_scores_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_player_match_scores_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      league_cricket_matches: {
        Row: {
          auto_enabled: boolean | null
          city: string | null
          created_at: string | null
          cricbuzz_match_id: number | null
          error_count: number | null
          id: string | null
          last_polled_at: string | null
          league_id: string | null
          league_match_id: string | null
          man_of_match_id: string | null
          man_of_match_name: string | null
          match_date: string | null
          match_description: string | null
          match_format: string | null
          match_state: string | null
          poll_count: number | null
          polling_enabled: boolean | null
          result: string | null
          series_id: number | null
          state: string | null
          stats_imported: boolean | null
          stats_imported_at: string | null
          team1_id: number | null
          team1_name: string | null
          team1_score: string | null
          team1_short: string | null
          team2_id: number | null
          team2_name: string | null
          team2_score: string | null
          team2_short: string | null
          venue: string | null
          week: number | null
          winner_team_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_matches_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_players: {
        Row: {
          batting_style: string | null
          bio: string | null
          birth_place: string | null
          bowling_style: string | null
          created_at: string | null
          cricbuzz_id: string | null
          dob: string | null
          height: string | null
          id: string | null
          image_id: number | null
          is_available: boolean | null
          is_international: boolean | null
          league_id: string | null
          name: string | null
          role: string | null
          team: string | null
          team_override: string | null
          teams: string[] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "league_player_pool_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_fantasy_standings: {
        Row: {
          active_points: number | null
          league_id: string | null
          manager_id: string | null
          team_name: string | null
          total_points: number | null
          week: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_player_match_scores_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_player_match_scores_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      player_fantasy_performance: {
        Row: {
          avg_fantasy_points: number | null
          ipl_team: string | null
          league_id: string | null
          matches_played: number | null
          player_id: string | null
          player_name: string | null
          role: string | null
          total_dismissals: number | null
          total_fantasy_points: number | null
          total_runs: number | null
          total_wickets: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_player_match_scores_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_player_match_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "league_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_player_match_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "master_players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_match_stats_compat: {
        Row: {
          balls_faced: number | null
          batting_position: number | null
          catches: number | null
          created_at: string | null
          cricbuzz_player_id: string | null
          dismissal_type: string | null
          dots: number | null
          economy: number | null
          fantasy_points: number | null
          finalized_at: string | null
          fours: number | null
          id: string | null
          is_impact_player: boolean | null
          is_in_playing_11: boolean | null
          is_live_stats: boolean | null
          is_man_of_match: boolean | null
          is_out: boolean | null
          lbw_bowled_count: number | null
          league_id: string | null
          live_updated_at: string | null
          maidens: number | null
          manager_id: string | null
          match_id: string | null
          no_balls: number | null
          overs: number | null
          player_id: string | null
          run_outs: number | null
          runs: number | null
          runs_conceded: number | null
          sixes: number | null
          strike_rate: number | null
          stumpings: number | null
          team_won: boolean | null
          was_in_active_roster: boolean | null
          week: number | null
          wickets: number | null
          wides: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_matches_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_player_match_scores_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "cricket_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "league_cricket_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "league_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "master_players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acquire_polling_lock: {
        Args: { p_cricbuzz_match_id: number; p_lock_duration_seconds?: number }
        Returns: boolean
      }
      batch_update_league_scores: { Args: { p_updates: Json }; Returns: number }
      disable_match_polling: {
        Args: { p_cricbuzz_match_id: number }
        Returns: undefined
      }
      enable_match_polling: {
        Args: {
          p_auto?: boolean
          p_cricbuzz_match_id: number
          p_initial_state?: string
        }
        Returns: string
      }
      finalize_match_stats: {
        Args: {
          p_league_id: string
          p_man_of_match_cricbuzz_id?: string
          p_match_id: string
        }
        Returns: number
      }
      get_fantasy_standings: {
        Args: { p_league_id: string }
        Returns: {
          manager_id: string
          manager_name: string
          rank: number
          team_name: string
          total_points: number
        }[]
      }
      get_league_match_stats_for_recompute: {
        Args: { p_league_id: string }
        Returns: {
          balls_faced: number
          catches: number
          dots: number
          fours: number
          is_impact_player: boolean
          is_in_playing_11: boolean
          is_man_of_match: boolean
          is_out: boolean
          lbw_bowled_count: number
          maidens: number
          match_id: string
          no_balls: number
          overs: number
          player_id: string
          run_outs: number
          runs: number
          runs_conceded: number
          score_id: string
          sixes: number
          stumpings: number
          team_won: boolean
          wickets: number
          wides: number
        }[]
      }
      get_leagues_for_cricbuzz_match: {
        Args: { p_cricbuzz_match_id: number }
        Returns: {
          league_id: string
          match_id: string
          scoring_rules: Json
        }[]
      }
      get_live_fantasy_standings: {
        Args: { p_league_id: string }
        Returns: {
          finalized_points: number
          has_live_stats: boolean
          live_points: number
          manager_id: string
          manager_name: string
          rank: number
          team_name: string
          total_points: number
        }[]
      }
      get_manager_total_points: {
        Args: { p_league_id: string; p_manager_id: string }
        Returns: number
      }
      get_manager_weekly_points: {
        Args: { p_league_id: string; p_manager_id: string; p_week: number }
        Returns: number
      }
      get_matches_to_poll: {
        Args: never
        Returns: {
          cricbuzz_match_id: number
          last_polled_at: string
          match_state: string
          poll_count: number
        }[]
      }
      get_player_weekly_points: {
        Args: { p_league_id: string; p_player_id: string; p_week: number }
        Returns: number
      }
      get_upcoming_matches_to_activate: {
        Args: { p_lookahead_minutes?: number }
        Returns: {
          cricbuzz_match_id: number
          current_state: string
          match_date: string
          match_description: string
          match_id: string
        }[]
      }
      record_poll_error: {
        Args: { p_cricbuzz_match_id: number; p_error_message: string }
        Returns: undefined
      }
      record_poll_success: {
        Args: { p_cricbuzz_match_id: number; p_match_state?: string }
        Returns: undefined
      }
      release_polling_lock: {
        Args: { p_cricbuzz_match_id: number }
        Returns: undefined
      }
      update_league_standings: {
        Args: { league_uuid: string }
        Returns: undefined
      }
      upsert_league_match: {
        Args: {
          p_cricbuzz_match_id: number
          p_league_id: string
          p_match_date?: string
          p_match_description?: string
          p_match_format?: string
          p_result?: string
          p_series_id?: number
          p_team1_name?: string
          p_team2_name?: string
          p_venue?: string
          p_week?: number
        }
        Returns: {
          is_new_match: boolean
          out_league_match_id: string
          out_match_id: string
        }[]
      }
    }
    Enums: {
      match_state_enum: "Upcoming" | "Live" | "Complete"
      player_availability: "available" | "rostered" | "injured" | "suspended"
      player_role_enum: "Batsman" | "Bowler" | "All Rounder" | "Wicket Keeper"
      slot_type_enum: "active" | "bench"
      trade_side_enum: "proposer" | "target"
      trade_status_enum: "pending" | "accepted" | "rejected" | "countered"
      transaction_type_enum: "add" | "drop" | "trade" | "score"
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
      match_state_enum: ["Upcoming", "Live", "Complete"],
      player_availability: ["available", "rostered", "injured", "suspended"],
      player_role_enum: ["Batsman", "Bowler", "All Rounder", "Wicket Keeper"],
      slot_type_enum: ["active", "bench"],
      trade_side_enum: ["proposer", "target"],
      trade_status_enum: ["pending", "accepted", "rejected", "countered"],
      transaction_type_enum: ["add", "drop", "trade", "score"],
    },
  },
} as const
