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
      admin_users: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: string | null
        }
        Insert: {
          key: string
          value?: string | null
        }
        Update: {
          key?: string
          value?: string | null
        }
        Relationships: []
      }
      category_sizes: {
        Row: {
          category_id: string
          created_at: string
          display_order: number | null
          id: string
          size_name: string
        }
        Insert: {
          category_id: string
          created_at?: string
          display_order?: number | null
          id?: string
          size_name: string
        }
        Update: {
          category_id?: string
          created_at?: string
          display_order?: number | null
          id?: string
          size_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_sizes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      country_shipping_prices: {
        Row: {
          country_code: string
          country_name: string | null
          created_at: string
          id: number
          max_delivery_days: number | null
          min_delivery_days: number | null
          shipping_price: number
          updated_at: string
        }
        Insert: {
          country_code: string
          country_name?: string | null
          created_at?: string
          id?: never
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          shipping_price?: number
          updated_at?: string
        }
        Update: {
          country_code?: string
          country_name?: string | null
          created_at?: string
          id?: never
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          shipping_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      hero_content: {
        Row: {
          id: number
          image_url: string | null
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          image_url?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          image_url?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      homepage_layout: {
        Row: {
          created_at: string
          display_order: number
          item_id: string
          item_type: string
          page_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          item_id: string
          item_type: string
          page_path?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          item_id?: string
          item_type?: string
          page_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price_at_purchase: number
          product_name: string
          product_size: string | null
          product_variant_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price_at_purchase: number
          product_name: string
          product_size?: string | null
          product_variant_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price_at_purchase?: number
          product_name?: string
          product_size?: string | null
          product_variant_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          order_details: Json | null
          payment_intent_id: string
          shipping_address1: string
          shipping_address2: string | null
          shipping_city: string
          shipping_country: string
          shipping_email: string | null
          shipping_name: string
          shipping_phone: string | null
          shipping_postal_code: string
          shipping_state: string | null
          shipping_status: string | null
          status: string
          stripe_session_id: string | null
          total_amount: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_details?: Json | null
          payment_intent_id: string
          shipping_address1: string
          shipping_address2?: string | null
          shipping_city: string
          shipping_country: string
          shipping_email?: string | null
          shipping_name: string
          shipping_phone?: string | null
          shipping_postal_code: string
          shipping_state?: string | null
          shipping_status?: string | null
          status?: string
          stripe_session_id?: string | null
          total_amount: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_details?: Json | null
          payment_intent_id?: string
          shipping_address1?: string
          shipping_address2?: string | null
          shipping_city?: string
          shipping_country?: string
          shipping_email?: string | null
          shipping_name?: string
          shipping_phone?: string | null
          shipping_postal_code?: string
          shipping_state?: string | null
          shipping_status?: string | null
          status?: string
          stripe_session_id?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      page_components: {
        Row: {
          affiliation: string
          content: Json
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean
          page_path: string
          position: Json
          type: string
          updated_at: string
        }
        Insert: {
          affiliation: string
          content: Json
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          page_path?: string
          position: Json
          type: string
          updated_at?: string
        }
        Update: {
          affiliation?: string
          content?: Json
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          page_path?: string
          position?: Json
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          size_guide_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          size_guide_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          size_guide_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_size_guide_id_fkey"
            columns: ["size_guide_id"]
            isOneToOne: false
            referencedRelation: "size_guide_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_url: string
          position: number | null
          product_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url: string
          position?: number | null
          product_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url?: string
          position?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          product_id: string
          size_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          size_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          size_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          price: number
          slug: string
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          price: number
          slug: string
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          price?: number
          slug?: string
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      set_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_url: string
          position: number | null
          set_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url: string
          position?: number | null
          set_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url?: string
          position?: number | null
          set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_images_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
        ]
      }
      set_products: {
        Row: {
          position: number | null
          product_id: string
          set_id: string
        }
        Insert: {
          position?: number | null
          product_id: string
          set_id: string
        }
        Update: {
          position?: number | null
          product_id?: string
          set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_products_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
        ]
      }
      sets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          layout_type: string | null
          name: string
          show_title_on_home: boolean | null
          slug: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          layout_type?: string | null
          name: string
          show_title_on_home?: boolean | null
          slug: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          layout_type?: string | null
          name?: string
          show_title_on_home?: boolean | null
          slug?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      size_guide_templates: {
        Row: {
          created_at: string
          guide_data: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          guide_data: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          guide_data?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      setup_sync_settings: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_homepage_layout_orders: {
        Args: {
          p_page_path: string
          items_to_insert: Database["public"]["CompositeTypes"]["homepage_layout_upsert_item"][]
        }
        Returns: undefined
      }
      update_set_product_positions: {
        Args: { _set_id: string; _products_data: Json }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      homepage_layout_upsert_item: {
        item_id: string | null
        item_type: string | null
        new_display_order: number | null
      }
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
