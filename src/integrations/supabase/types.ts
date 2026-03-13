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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alert_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          pair_id: string
          rule_id: string
          score_at_trigger: number
          trend_at_trigger: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          pair_id: string
          rule_id: string
          score_at_trigger: number
          trend_at_trigger: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          pair_id?: string
          rule_id?: string
          score_at_trigger?: number
          trend_at_trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_notifications_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_notifications_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          created_at: string
          direction: string
          id: string
          is_active: boolean
          pair_id: string | null
          rule_type: string
          threshold: number
          user_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          is_active?: boolean
          pair_id?: string | null
          rule_type: string
          threshold: number
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          is_active?: boolean
          pair_id?: string | null
          rule_type?: string
          threshold?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      candles: {
        Row: {
          close: number
          created_at: string
          high: number
          id: string
          low: number
          open: number
          pair_id: string
          timeframe: string
          ts: string
          volume: number | null
        }
        Insert: {
          close: number
          created_at?: string
          high: number
          id?: string
          low: number
          open: number
          pair_id: string
          timeframe: string
          ts: string
          volume?: number | null
        }
        Update: {
          close?: number
          created_at?: string
          high?: number
          id?: string
          low?: number
          open?: number
          pair_id?: string
          timeframe?: string
          ts?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candles_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      pairs: {
        Row: {
          base_currency: string | null
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          quote_currency: string | null
          symbol: string
        }
        Insert: {
          base_currency?: string | null
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          quote_currency?: string | null
          symbol: string
        }
        Update: {
          base_currency?: string | null
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          quote_currency?: string | null
          symbol?: string
        }
        Relationships: []
      }
      scan_history: {
        Row: {
          id: string
          result: Json
          scanned_at: string
          user_id: string
        }
        Insert: {
          id?: string
          result: Json
          scanned_at?: string
          user_id: string
        }
        Update: {
          id?: string
          result?: Json
          scanned_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          adx: number | null
          adx_score: number | null
          ema_score: number | null
          ema20: number | null
          ema200: number | null
          ema50: number | null
          id: string
          macd_hist: number | null
          macd_score: number | null
          pair_id: string
          rsi: number | null
          rsi_score: number | null
          scanned_at: string
          score: number
          timeframe: string
          trend: string
        }
        Insert: {
          adx?: number | null
          adx_score?: number | null
          ema_score?: number | null
          ema20?: number | null
          ema200?: number | null
          ema50?: number | null
          id?: string
          macd_hist?: number | null
          macd_score?: number | null
          pair_id: string
          rsi?: number | null
          rsi_score?: number | null
          scanned_at?: string
          score: number
          timeframe: string
          trend: string
        }
        Update: {
          adx?: number | null
          adx_score?: number | null
          ema_score?: number | null
          ema20?: number | null
          ema200?: number | null
          ema50?: number | null
          id?: string
          macd_hist?: number | null
          macd_score?: number | null
          pair_id?: string
          rsi?: number | null
          rsi_score?: number | null
          scanned_at?: string
          score?: number
          timeframe?: string
          trend?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          id: string
          name: string
          pair_ids: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          pair_ids?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pair_ids?: string[] | null
          user_id?: string
        }
        Relationships: []
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
