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
      draft_order: {
        Row: {
          created_at: string
          id: string
          manager_id: string | null
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id?: string | null
          position: number
        }
        Update: {
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
          manager_id: string | null
          pick_position: number
          player_id: string | null
          round: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id?: string | null
          pick_position: number
          player_id?: string | null
          round: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
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
          created_at: string
          finalized_at: string | null
          id: string
          is_finalized: boolean
        }
        Insert: {
          created_at?: string
          finalized_at?: string | null
          id?: string
          is_finalized?: boolean
        }
        Update: {
          created_at?: string
          finalized_at?: string | null
          id?: string
          is_finalized?: boolean
        }
        Relationships: []
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
        }
        Relationships: [
          {
            foreignKeyName: "managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
        }
        Insert: {
          created_at?: string
          id?: string
          is_international?: boolean
          name: string
          role: string
          team: string
        }
        Update: {
          created_at?: string
          id?: string
          is_international?: boolean
          name?: string
          role?: string
          team?: string
        }
        Relationships: []
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
        }
        Relationships: [
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
