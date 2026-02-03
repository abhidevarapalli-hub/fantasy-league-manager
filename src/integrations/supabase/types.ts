export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      draft_order: {
        Row: {
          auto_draft_enabled: boolean
          created_at: string
          id: string
          manager_id: string | null
          position: number
        }
        Insert: {
          auto_draft_enabled?: boolean
          created_at?: string
          id?: string
          manager_id?: string | null
          position: number
        }
        Update: {
          auto_draft_enabled?: boolean
          created_at?: string
          id?: string
          manager_id?: string | null
          position?: number
        }
        Relationships: [
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
          is_auto_draft: boolean
          manager_id: string | null
          pick_position: number
          player_id: string | null
          round: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_auto_draft?: boolean
          manager_id?: string | null
          pick_position: number
          player_id?: string | null
          round: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_auto_draft?: boolean
          manager_id?: string | null
          pick_position?: number
          player_id?: string | null
          round?: number
          updated_at?: string
        }
        Relationships: [
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
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_state: {
        Row: {
          current_pick_start_at: string | null
          id: string
          is_active: boolean
          is_finalized: boolean
          paused_at: string | null
          created_at: string
          finalized_at: string | null
        }
        Insert: {
          current_pick_start_at?: string | null
          id?: string
          is_active?: boolean
          is_finalized?: boolean
          paused_at?: string | null
          created_at?: string
          finalized_at?: string | null
        }
        Update: {
          current_pick_start_at?: string | null
          id?: string
          is_active?: boolean
          is_finalized?: boolean
          paused_at?: string | null
          created_at?: string
          finalized_at?: string | null
        }
        Relationships: []
      }
      extended_players: {
        Row: {
          batting_style: string | null
          birth_place: string | null
          bowling_style: string | null
          cricbuzz_id: string
          created_at: string
          dob: string | null
          height: string | null
          image_id: number | null
          player_id: string
          teams: string[] | null
          updated_at: string
        }
        Insert: {
          batting_style?: string | null
          birth_place?: string | null
          bowling_style?: string | null
          cricbuzz_id: string
          created_at?: string
          dob?: string | null
          height?: string | null
          image_id?: number | null
          player_id: string
          teams?: string[] | null
          updated_at?: string
        }
        Update: {
          batting_style?: string | null
          birth_place?: string | null
          bowling_style?: string | null
          cricbuzz_id?: string
          created_at?: string
          dob?: string | null
          height?: string | null
          image_id?: number | null
          player_id?: string
          teams?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extended_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          id: string
          manager_count: number
          name: string
          scoring_rules: Json
          status: string
          updated_at: string
          tournament: string | null
          active_size: number
          bench_size: number
          league_manager_id: string | null
          max_batsmen: number
          max_international: number
          min_all_rounders: number
          min_batsmen: number
          min_bowlers: number
          min_wks: number
          tournament_id: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          manager_count: number
          name: string
          scoring_rules?: Json
          status?: string
          updated_at?: string
          tournament?: string | null
          active_size?: number
          bench_size?: number
          league_manager_id?: string | null
          max_batsmen?: number
          max_international?: number
          min_all_rounders?: number
          min_batsmen?: number
          min_bowlers?: number
          min_wks?: number
          tournament_id?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          manager_count?: number
          name?: string
          scoring_rules?: Json
          status?: string
          updated_at?: string
          tournament?: string | null
          active_size?: number
          bench_size?: number
          league_manager_id?: string | null
          max_batsmen?: number
          max_international?: number
          min_all_rounders?: number
          min_batsmen?: number
          min_bowlers?: number
          min_wks?: number
          tournament_id?: number | null
        }
        Relationships: []
      }
      cricket_matches: {
        Row: {
          city: string | null
          created_at: string
          cricbuzz_match_id: number
          id: string
          league_id: string | null
          match_date: string | null
          match_description: string | null
          match_format: string | null
          result: string | null
          series_id: number
          state: string | null
          stats_imported: boolean
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
        Insert: {
          city?: string | null
          created_at?: string
          cricbuzz_match_id: number
          id?: string
          league_id?: string | null
          match_date?: string | null
          match_description?: string | null
          match_format?: string | null
          result?: string | null
          series_id: number
          state?: string | null
          stats_imported?: boolean
          stats_imported_at?: string | null
          team1_id?: number | null
          team1_name?: string | null
          team1_score?: string | null
          team1_short?: string | null
          team2_id?: number | null
          team2_name?: string | null
          team2_score?: string | null
          team2_short?: string | null
          venue?: string | null
          week?: number | null
          winner_team_id?: number | null
        }
        Update: {
          city?: string | null
          created_at?: string
          cricbuzz_match_id: number
          id?: string
          league_id?: string | null
          match_date?: string | null
          match_description?: string | null
          match_format?: string | null
          result?: string | null
          series_id?: number
          state?: string | null
          stats_imported?: boolean
          stats_imported_at?: string | null
          team1_id?: number | null
          team1_name?: string | null
          team1_score?: string | null
          team1_short?: string | null
          team2_id?: number | null
          team2_name?: string | null
          team2_score?: string | null
          team2_short?: string | null
          venue?: string | null
          week?: number | null
          winner_team_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cricket_matches_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      player_match_stats: {
        Row: {
          balls_faced: number
          batting_position: number | null
          catches: number
          created_at: string
          cricbuzz_player_id: string
          dismissal_type: string | null
          dots: number
          economy: number | null
          fantasy_points: number | null
          fours: number
          id: string
          is_impact_player: boolean
          is_in_playing_11: boolean
          is_man_of_match: boolean
          is_out: boolean
          league_id: string | null
          maidens: number
          manager_id: string | null
          match_id: string | null
          no_balls: number
          overs: number
          player_id: string | null
          run_outs: number
          runs: number
          runs_conceded: number
          sixes: number
          strike_rate: number | null
          stumpings: number
          team_won: boolean
          was_in_active_roster: boolean
          week: number | null
          wickets: number
          wides: number
          lbw_bowled_count: number
        }
        Insert: {
          balls_faced?: number
          batting_position?: number | null
          catches?: number
          created_at?: string
          cricbuzz_player_id: string
          dismissal_type?: string | null
          dots?: number
          economy?: number | null
          fantasy_points?: number | null
          fours?: number
          id?: string
          is_impact_player?: boolean
          is_in_playing_11?: boolean
          is_man_of_match?: boolean
          is_out?: boolean
          league_id?: string | null
          maidens?: number
          manager_id?: string | null
          match_id?: string | null
          no_balls?: number
          overs?: number
          player_id?: string | null
          run_outs?: number
          runs?: number
          runs_conceded?: number
          sixes?: number
          strike_rate?: number | null
          stumpings?: number
          team_won?: boolean
          was_in_active_roster?: boolean
          week?: number | null
          wickets?: number
          wides?: number
          lbw_bowled_count?: number
        }
        Update: {
          balls_faced?: number
          batting_position?: number | null
          catches?: number
          created_at?: string
          cricbuzz_player_id: string
          dismissal_type?: string | null
          dots?: number
          economy?: number | null
          fantasy_points?: number | null
          fours?: number
          id?: string
          is_impact_player?: boolean
          is_in_playing_11?: boolean
          is_man_of_match?: boolean
          is_out?: boolean
          league_id?: string | null
          maidens?: number
          manager_id?: string | null
          match_id?: string | null
          no_balls?: number
          overs?: number
          player_id?: string | null
          run_outs?: number
          runs?: number
          runs_conceded?: number
          sixes?: number
          strike_rate?: number | null
          stumpings?: number
          team_won?: boolean
          was_in_active_roster?: boolean
          week?: number | null
          wickets?: number
          wides?: number
          lbw_bowled_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_match_stats_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_match_stats_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_match_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "cricket_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_match_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      head_to_head: {
        Row: {
          created_at: string
          id: string
          manager1_name: string
          manager1_wins: number
          manager2_name: string
          manager2_wins: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager1_name: string
          manager1_wins?: number
          manager2_name: string
          manager2_wins?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager1_name?: string
          manager1_wins?: number
          manager2_name?: string
          manager2_wins?: number
          updated_at?: string
        }
        Relationships: []
      }
      historical_records: {
        Row: {
          championships: number
          created_at: string
          historical_losses: number
          historical_wins: number
          id: string
          manager_name: string
          top_3_finishes: number
          updated_at: string
        }
        Insert: {
          championships?: number
          created_at?: string
          historical_losses?: number
          historical_wins?: number
          id?: string
          manager_name: string
          top_3_finishes?: number
          updated_at?: string
        }
        Update: {
          championships?: number
          created_at?: string
          historical_losses?: number
          historical_wins?: number
          id?: string
          manager_name?: string
          top_3_finishes?: number
          updated_at?: string
        }
        Relationships: []
      }
      managers: {
        Row: {
          bench: string[] | null
          created_at: string
          id: string
          losses: number
          name: string
          points: number
          roster: string[] | null
          team_name: string
          wins: number
          user_id: string | null
          is_league_manager: boolean
          league_id: string | null
        }
        Insert: {
          bench?: string[] | null
          created_at?: string
          id?: string
          losses?: number
          name: string
          points?: number
          roster?: string[] | null
          team_name: string
          wins?: number
          user_id?: string | null
          is_league_manager?: boolean
          league_id?: string | null
        }
        Update: {
          bench?: string[] | null
          created_at?: string
          id?: string
          losses?: number
          name?: string
          points?: number
          roster?: string[] | null
          team_name?: string
          wins?: number
          user_id?: string | null
          is_league_manager?: boolean
          league_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "managers_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          }
        ]
      }
      players: {
        Row: {
          created_at: string
          id: string
          is_international: boolean
          name: string
          role: string
          team: string
          league_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_international?: boolean
          name: string
          role: string
          team: string
          league_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_international?: boolean
          name?: string
          role?: string
          team?: string
          league_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          }
        ]
      }
      schedule: {
        Row: {
          away_manager_id: string | null
          away_score: number | null
          created_at: string
          home_manager_id: string | null
          home_score: number | null
          id: string
          is_finalized: boolean
          week: number
          league_id: string | null
        }
        Insert: {
          away_manager_id?: string | null
          away_score?: number | null
          created_at?: string
          home_manager_id?: string | null
          home_score?: number | null
          id?: string
          is_finalized?: boolean
          week: number
          league_id?: string | null
        }
        Update: {
          away_manager_id?: string | null
          away_score?: number | null
          created_at?: string
          home_manager_id?: string | null
          home_score?: number | null
          id?: string
          is_finalized?: boolean
          week?: number
          league_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_away_manager_id_fkey"
            columns: ["away_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_home_manager_id_fkey"
            columns: ["home_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          }
        ]
      }
      trades: {
        Row: {
          created_at: string
          id: string
          parent_trade_id: string | null
          proposer_id: string
          proposer_players: string[]
          status: string
          target_id: string
          target_players: string[]
          updated_at: string
          league_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          parent_trade_id?: string | null
          proposer_id: string
          proposer_players?: string[]
          status?: string
          target_id: string
          target_players?: string[]
          updated_at?: string
          league_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          parent_trade_id?: string | null
          proposer_id?: string
          proposer_players?: string[]
          status?: string
          target_id?: string
          target_players?: string[]
          updated_at?: string
          league_id?: string | null
        }
        Relationships: [
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
          {
            foreignKeyName: "trades_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          }
        ]
      }
      transactions: {
        Row: {
          created_at: string
          description: string
          id: string
          manager_id: string | null
          manager_team_name: string | null
          players: Json | null
          type: string
          week: number | null
          league_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          manager_id?: string | null
          manager_team_name?: string | null
          players?: Json | null
          type: string
          week?: number | null
          league_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          manager_id?: string | null
          manager_team_name?: string | null
          players?: Json | null
          type?: string
          week?: number | null
          league_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_league_standings: {
        Args: {
          league_uuid: string
        }
        Returns: undefined
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
    Enums: {},
  },
} as const
