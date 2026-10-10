// Generado por qa/pg-harness/gen_types.py desde supabase/migrations. No editar a mano.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      audit_history: {
        Row: {
          id: number
          entity: string
          entity_id: string
          field: string
          old_value: Json | null
          new_value: Json | null
          user_id: string | null
          occurred_at: string
        }
        Insert: {
          id?: number
          entity: string
          entity_id: string
          field: string
          old_value?: Json | null
          new_value?: Json | null
          user_id?: string | null
          occurred_at?: string
        }
        Update: {
          id?: number
          entity?: string
          entity_id?: string
          field?: string
          old_value?: Json | null
          new_value?: Json | null
          user_id?: string | null
          occurred_at?: string
        }
        Relationships: [
          { foreignKeyName: "audit_history_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      branch_prices: {
        Row: {
          branch_id: string
          presentation_id: string
          sale_price: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          presentation_id: string
          sale_price: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          presentation_id?: string
          sale_price?: number
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "branch_prices_branch_id_fkey"; columns: ["branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "branch_prices_presentation_id_fkey"; columns: ["presentation_id"]; isOneToOne: false; referencedRelation: "product_presentations"; referencedColumns: ["id"] },
          { foreignKeyName: "branch_prices_updated_by_fkey"; columns: ["updated_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      branches: {
        Row: {
          id: string
          name: string
          address: string | null
          created_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          created_at?: string
          archived_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          created_at?: string
          archived_at?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          id: string
          name: string
          archived_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          archived_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          archived_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      cash_shifts: {
        Row: {
          id: string
          register_id: string
          opened_at: string
          closed_at: string | null
          initial_balance: number
          final_balance: number | null
          status: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          register_id: string
          opened_at?: string
          closed_at?: string | null
          initial_balance?: number
          final_balance?: number | null
          status?: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          register_id?: string
          opened_at?: string
          closed_at?: string | null
          initial_balance?: number
          final_balance?: number | null
          status?: string
          user_id?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "cash_shifts_register_id_fkey"; columns: ["register_id"]; isOneToOne: false; referencedRelation: "registers"; referencedColumns: ["id"] },
          { foreignKeyName: "cash_shifts_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      categories: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          archived_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          archived_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          archived_at?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "categories_parent_id_fkey"; columns: ["parent_id"]; isOneToOne: false; referencedRelation: "categories"; referencedColumns: ["id"] }
        ]
      }
      category_price_multipliers: {
        Row: {
          category_id: string
          multiplier: number
          updated_at: string
        }
        Insert: {
          category_id: string
          multiplier: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          multiplier?: number
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "category_price_multipliers_category_id_fkey"; columns: ["category_id"]; isOneToOne: true; referencedRelation: "categories"; referencedColumns: ["id"] }
        ]
      }
      credit_movements: {
        Row: {
          id: string
          local_id: string
          customer_id: string
          sale_id: string | null
          kind: Database["public"]["Enums"]["credit_movement_kind"]
          amount: number
          note: string | null
          user_id: string
          occurred_at: string
          created_at: string
          adjustment_sign: number | null
        }
        Insert: {
          id?: string
          local_id: string
          customer_id: string
          sale_id?: string | null
          kind: Database["public"]["Enums"]["credit_movement_kind"]
          amount: number
          note?: string | null
          user_id: string
          occurred_at: string
          created_at?: string
          adjustment_sign?: number | null
        }
        Update: {
          id?: string
          local_id?: string
          customer_id?: string
          sale_id?: string | null
          kind?: Database["public"]["Enums"]["credit_movement_kind"]
          amount?: number
          note?: string | null
          user_id?: string
          occurred_at?: string
          created_at?: string
          adjustment_sign?: number | null
        }
        Relationships: [
          { foreignKeyName: "credit_movements_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "credit_movements_sale_id_fkey"; columns: ["sale_id"]; isOneToOne: false; referencedRelation: "sales"; referencedColumns: ["id"] },
          { foreignKeyName: "credit_movements_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          credit_limit: number | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          credit_limit?: number | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          credit_limit?: number | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          id: string
          name: string
          archived_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          archived_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          archived_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      missing_items: {
        Row: {
          id: string
          product_id: string
          reported_by: string
          note: string | null
          resolved: boolean
          created_at: string
          updated_at: string
          branch_id: string | null
        }
        Insert: {
          id?: string
          product_id: string
          reported_by: string
          note?: string | null
          resolved?: boolean
          created_at?: string
          updated_at?: string
          branch_id?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          reported_by?: string
          note?: string | null
          resolved?: boolean
          created_at?: string
          updated_at?: string
          branch_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "missing_items_branch_id_fkey"; columns: ["branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "missing_items_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "missing_items_reported_by_fkey"; columns: ["reported_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      offline_operations: {
        Row: {
          id: string
          local_id: string
          device_id: string
          kind: Database["public"]["Enums"]["offline_operation_kind"]
          payload: Json
          occurred_at: string
          received_at: string
          received_by: string
        }
        Insert: {
          id?: string
          local_id: string
          device_id: string
          kind: Database["public"]["Enums"]["offline_operation_kind"]
          payload: Json
          occurred_at: string
          received_at?: string
          received_by: string
        }
        Update: {
          id?: string
          local_id?: string
          device_id?: string
          kind?: Database["public"]["Enums"]["offline_operation_kind"]
          payload?: Json
          occurred_at?: string
          received_at?: string
          received_by?: string
        }
        Relationships: [
          { foreignKeyName: "offline_operations_received_by_fkey"; columns: ["received_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      price_update_batches: {
        Row: {
          id: string
          created_by: string | null
          created_at: string
          percent: number
          scope: string
          scope_id: string | null
          round_to: number | null
          changed_count: number
          branch_id: string | null
        }
        Insert: {
          id?: string
          created_by?: string | null
          created_at?: string
          percent: number
          scope: string
          scope_id?: string | null
          round_to?: number | null
          changed_count?: number
          branch_id?: string | null
        }
        Update: {
          id?: string
          created_by?: string | null
          created_at?: string
          percent?: number
          scope?: string
          scope_id?: string | null
          round_to?: number | null
          changed_count?: number
          branch_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "price_update_batches_branch_id_fkey"; columns: ["branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "price_update_batches_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      pricing_settings: {
        Row: {
          id: number
          default_multiplier: number
          updated_at: string
        }
        Insert: {
          id: number
          default_multiplier?: number
          updated_at?: string
        }
        Update: {
          id?: number
          default_multiplier?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_labels: {
        Row: {
          product_id: string
          label_id: string
        }
        Insert: {
          product_id: string
          label_id: string
        }
        Update: {
          product_id?: string
          label_id?: string
        }
        Relationships: [
          { foreignKeyName: "product_labels_label_id_fkey"; columns: ["label_id"]; isOneToOne: false; referencedRelation: "labels"; referencedColumns: ["id"] },
          { foreignKeyName: "product_labels_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }
        ]
      }
      product_presentations: {
        Row: {
          id: string
          product_id: string
          name: string
          base_quantity: number
          internal_barcode: string | null
          sale_price: number
          active: boolean
          created_at: string
          updated_at: string
          sold_by_weight: boolean
        }
        Insert: {
          id?: string
          product_id: string
          name: string
          base_quantity: number
          internal_barcode?: string | null
          sale_price?: number
          active?: boolean
          created_at?: string
          updated_at?: string
          sold_by_weight?: boolean
        }
        Update: {
          id?: string
          product_id?: string
          name?: string
          base_quantity?: number
          internal_barcode?: string | null
          sale_price?: number
          active?: boolean
          created_at?: string
          updated_at?: string
          sold_by_weight?: boolean
        }
        Relationships: [
          { foreignKeyName: "product_presentations_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }
        ]
      }
      product_price_history: {
        Row: {
          id: string
          presentation_id: string
          sale_price: number
          changed_by: string | null
          changed_at: string
          previous_price: number | null
          batch_id: string | null
          branch_id: string | null
        }
        Insert: {
          id?: string
          presentation_id: string
          sale_price: number
          changed_by?: string | null
          changed_at?: string
          previous_price?: number | null
          batch_id?: string | null
          branch_id?: string | null
        }
        Update: {
          id?: string
          presentation_id?: string
          sale_price?: number
          changed_by?: string | null
          changed_at?: string
          previous_price?: number | null
          batch_id?: string | null
          branch_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "product_price_history_batch_id_fkey"; columns: ["batch_id"]; isOneToOne: false; referencedRelation: "price_update_batches"; referencedColumns: ["id"] },
          { foreignKeyName: "product_price_history_branch_id_fkey"; columns: ["branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "product_price_history_changed_by_fkey"; columns: ["changed_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "product_price_history_presentation_id_fkey"; columns: ["presentation_id"]; isOneToOne: false; referencedRelation: "product_presentations"; referencedColumns: ["id"] }
        ]
      }
      products: {
        Row: {
          id: string
          name: string
          manufacturer_barcode: string | null
          brand_id: string | null
          category_id: string | null
          base_unit: Database["public"]["Enums"]["base_unit"]
          price_multiplier: number | null
          open_shelf_life_days: number | null
          label_text: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          manufacturer_barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          base_unit: Database["public"]["Enums"]["base_unit"]
          price_multiplier?: number | null
          open_shelf_life_days?: number | null
          label_text?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          manufacturer_barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          base_unit?: Database["public"]["Enums"]["base_unit"]
          price_multiplier?: number | null
          open_shelf_life_days?: number | null
          label_text?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "products_brand_id_fkey"; columns: ["brand_id"]; isOneToOne: false; referencedRelation: "brands"; referencedColumns: ["id"] },
          { foreignKeyName: "products_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "categories"; referencedColumns: ["id"] }
        ]
      }
      profiles: {
        Row: {
          id: string
          display_name: string
          role: Database["public"]["Enums"]["app_role"]
          branch_id: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name: string
          role?: Database["public"]["Enums"]["app_role"]
          branch_id?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          role?: Database["public"]["Enums"]["app_role"]
          branch_id?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "profiles_branch_id_fkey"; columns: ["branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "profiles_id_fkey"; columns: ["id"]; isOneToOne: true; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      registers: {
        Row: {
          id: string
          branch_id: string
          name: string
          created_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string
          branch_id: string
          name: string
          created_at?: string
          archived_at?: string | null
        }
        Update: {
          id?: string
          branch_id?: string
          name?: string
          created_at?: string
          archived_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "registers_branch_id_fkey"; columns: ["branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id"] }
        ]
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          presentation_id: string
          lot_id: string | null
          quantity: number
          unit_price: number
          local_id: string | null
          subtotal: number
        }
        Insert: {
          id?: string
          sale_id: string
          presentation_id: string
          lot_id?: string | null
          quantity: number
          unit_price: number
          local_id?: string | null
          subtotal?: number
        }
        Update: {
          id?: string
          sale_id?: string
          presentation_id?: string
          lot_id?: string | null
          quantity?: number
          unit_price?: number
          local_id?: string | null
          subtotal?: number
        }
        Relationships: [
          { foreignKeyName: "sale_items_lot_id_fkey"; columns: ["lot_id"]; isOneToOne: false; referencedRelation: "stock_lots"; referencedColumns: ["id"] },
          { foreignKeyName: "sale_items_presentation_id_fkey"; columns: ["presentation_id"]; isOneToOne: false; referencedRelation: "product_presentations"; referencedColumns: ["id"] },
          { foreignKeyName: "sale_items_sale_id_fkey"; columns: ["sale_id"]; isOneToOne: false; referencedRelation: "sales"; referencedColumns: ["id"] }
        ]
      }
      sales: {
        Row: {
          id: string
          local_id: string
          branch_id: string | null
          register_id: string | null
          user_id: string
          customer_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["sale_status"]
          occurred_at: string
          created_at: string
          shift_id: string | null
          total_amount: number
        }
        Insert: {
          id?: string
          local_id: string
          branch_id?: string | null
          register_id?: string | null
          user_id: string
          customer_id?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["sale_status"]
          occurred_at: string
          created_at?: string
          shift_id?: string | null
          total_amount?: number
        }
        Update: {
          id?: string
          local_id?: string
          branch_id?: string | null
          register_id?: string | null
          user_id?: string
          customer_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["sale_status"]
          occurred_at?: string
          created_at?: string
          shift_id?: string | null
          total_amount?: number
        }
        Relationships: [
          { foreignKeyName: "sales_branch_id_fkey"; columns: ["branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_register_id_fkey"; columns: ["register_id"]; isOneToOne: false; referencedRelation: "registers"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_shift_id_fkey"; columns: ["shift_id"]; isOneToOne: false; referencedRelation: "cash_shifts"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      stock_lots: {
        Row: {
          id: string
          presentation_id: string
          supplier_id: string | null
          initial_quantity: number
          current_quantity: number
          purchase_cost: number
          received_at: string
          manufacturer_expiry_date: string | null
          opened_at: string | null
          portioned_at: string | null
          status: Database["public"]["Enums"]["stock_lot_status"]
          created_at: string
          branch_id: string
        }
        Insert: {
          id?: string
          presentation_id: string
          supplier_id?: string | null
          initial_quantity: number
          current_quantity: number
          purchase_cost: number
          received_at?: string
          manufacturer_expiry_date?: string | null
          opened_at?: string | null
          portioned_at?: string | null
          status?: Database["public"]["Enums"]["stock_lot_status"]
          created_at?: string
          branch_id: string
        }
        Update: {
          id?: string
          presentation_id?: string
          supplier_id?: string | null
          initial_quantity?: number
          current_quantity?: number
          purchase_cost?: number
          received_at?: string
          manufacturer_expiry_date?: string | null
          opened_at?: string | null
          portioned_at?: string | null
          status?: Database["public"]["Enums"]["stock_lot_status"]
          created_at?: string
          branch_id?: string
        }
        Relationships: [
          { foreignKeyName: "stock_lots_branch_id_fkey"; columns: ["branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_lots_presentation_id_fkey"; columns: ["presentation_id"]; isOneToOne: false; referencedRelation: "product_presentations"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_lots_supplier_id_fkey"; columns: ["supplier_id"]; isOneToOne: false; referencedRelation: "suppliers"; referencedColumns: ["id"] }
        ]
      }
      stock_movements: {
        Row: {
          id: string
          local_id: string
          kind: Database["public"]["Enums"]["stock_movement_kind"]
          product_id: string
          lot_id: string | null
          quantity: number
          reason: string | null
          user_id: string
          occurred_at: string
          created_at: string
          branch_id: string | null
        }
        Insert: {
          id?: string
          local_id: string
          kind: Database["public"]["Enums"]["stock_movement_kind"]
          product_id: string
          lot_id?: string | null
          quantity: number
          reason?: string | null
          user_id: string
          occurred_at: string
          created_at?: string
          branch_id?: string | null
        }
        Update: {
          id?: string
          local_id?: string
          kind?: Database["public"]["Enums"]["stock_movement_kind"]
          product_id?: string
          lot_id?: string | null
          quantity?: number
          reason?: string | null
          user_id?: string
          occurred_at?: string
          created_at?: string
          branch_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "stock_movements_branch_id_fkey"; columns: ["branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_movements_lot_id_fkey"; columns: ["lot_id"]; isOneToOne: false; referencedRelation: "stock_lots"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_movements_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_movements_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      stock_transfers: {
        Row: {
          id: string
          local_id: string
          from_lot_id: string
          to_lot_id: string
          from_branch_id: string
          to_branch_id: string
          quantity: number
          note: string | null
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          local_id: string
          from_lot_id: string
          to_lot_id: string
          from_branch_id: string
          to_branch_id: string
          quantity: number
          note?: string | null
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          local_id?: string
          from_lot_id?: string
          to_lot_id?: string
          from_branch_id?: string
          to_branch_id?: string
          quantity?: number
          note?: string | null
          user_id?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "stock_transfers_from_branch_id_fkey"; columns: ["from_branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_transfers_from_lot_id_fkey"; columns: ["from_lot_id"]; isOneToOne: false; referencedRelation: "stock_lots"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_transfers_to_branch_id_fkey"; columns: ["to_branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_transfers_to_lot_id_fkey"; columns: ["to_lot_id"]; isOneToOne: false; referencedRelation: "stock_lots"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_transfers_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      stock_warnings: {
        Row: {
          id: string
          lot_id: string | null
          sale_id: string | null
          message: string
          created_at: string
          resolved_at: string | null
          resolved_by: string | null
          resolution: string | null
        }
        Insert: {
          id?: string
          lot_id?: string | null
          sale_id?: string | null
          message: string
          created_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolution?: string | null
        }
        Update: {
          id?: string
          lot_id?: string | null
          sale_id?: string | null
          message?: string
          created_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolution?: string | null
        }
        Relationships: [
          { foreignKeyName: "stock_warnings_lot_id_fkey"; columns: ["lot_id"]; isOneToOne: false; referencedRelation: "stock_lots"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_warnings_resolved_by_fkey"; columns: ["resolved_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_warnings_sale_id_fkey"; columns: ["sale_id"]; isOneToOne: false; referencedRelation: "sales"; referencedColumns: ["id"] }
        ]
      }
      supplier_products: {
        Row: {
          id: string
          product_id: string
          supplier_id: string
          supplier_product_code: string | null
          cost: number
          last_purchase_at: string | null
          is_primary: boolean
          purchase_quantity: number | null
        }
        Insert: {
          id?: string
          product_id: string
          supplier_id: string
          supplier_product_code?: string | null
          cost: number
          last_purchase_at?: string | null
          is_primary?: boolean
          purchase_quantity?: number | null
        }
        Update: {
          id?: string
          product_id?: string
          supplier_id?: string
          supplier_product_code?: string | null
          cost?: number
          last_purchase_at?: string | null
          is_primary?: boolean
          purchase_quantity?: number | null
        }
        Relationships: [
          { foreignKeyName: "supplier_products_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "supplier_products_supplier_id_fkey"; columns: ["supplier_id"]; isOneToOne: false; referencedRelation: "suppliers"; referencedColumns: ["id"] }
        ]
      }
      suppliers: {
        Row: {
          id: string
          name: string
          contact: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          contact?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          contact?: string | null
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      customer_accounts: {
        Row: {
          id: string | null
          name: string | null
          phone: string | null
          credit_limit: number | null
          active: boolean | null
          balance: number | null
          last_movement_at: string | null
        }
        Relationships: []
      }
      employee_catalog: {
        Row: {
          product_id: string | null
          product_name: string | null
          manufacturer_barcode: string | null
          base_unit: Database["public"]["Enums"]["base_unit"] | null
          open_shelf_life_days: number | null
          label_text: string | null
          brand_id: string | null
          brand_name: string | null
          category_id: string | null
          category_name: string | null
          presentation_id: string | null
          presentation_name: string | null
          base_quantity: number | null
          internal_barcode: string | null
          sale_price: number | null
          sold_by_weight: boolean | null
          labels: Json | null
          branch_prices: Json | null
        }
        Relationships: []
      }
      employee_stock_lots: {
        Row: {
          id: string | null
          presentation_id: string | null
          supplier_id: string | null
          initial_quantity: number | null
          current_quantity: number | null
          received_at: string | null
          manufacturer_expiry_date: string | null
          opened_at: string | null
          portioned_at: string | null
          status: Database["public"]["Enums"]["stock_lot_status"] | null
          effective_expiry_date: string | null
          product_id: string | null
          product_name: string | null
          base_unit: Database["public"]["Enums"]["base_unit"] | null
          open_shelf_life_days: number | null
          presentation_name: string | null
          base_quantity: number | null
          sold_by_weight: boolean | null
          supplier_name: string | null
          created_at: string | null
          branch_id: string | null
          branch_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_lot_id: string
          p_product_id: string
          p_kind: Database["public"]["Enums"]["stock_movement_kind"]
          p_quantity: number
          p_reason: string
          p_new_lot_quantity: number
          p_should_close_lot: boolean
        }
        Returns: undefined
      }
      apply_offline_operation: {
        Args: {
          p_operation: Json
        }
        Returns: boolean
      }
      assert_lot_branch_access: {
        Args: {
          p_lot_id: string
        }
        Returns: undefined
      }
      assign_classifier: {
        Args: {
          p_kind: string
          p_id: string
          p_product_ids: string[]
          p_remove?: boolean
        }
        Returns: number
      }
      audit_history_search: {
        Args: {
          p_text?: string
          p_entity?: string
          p_user_id?: string
          p_from?: string
          p_to?: string
          p_limit?: number
        }
        Returns: {
          id: number
          occurred_at: string
          entity: string
          entity_id: string
          entity_label: string
          field: string
          old_value: Json
          new_value: Json
          user_id: string
          user_name: string
        }[]
      }
      bulk_update_prices: {
        Args: {
          p_percent: number
          p_scope?: string
          p_scope_id?: string
          p_apply?: boolean
          p_round_to?: number
          p_branch_id?: string
        }
        Returns: {
          batch_id: string
          presentation_id: string
          product_id: string
          product_name: string
          presentation_name: string
          old_price: number
          new_price: number
          sold_by_weight: boolean
        }[]
      }
      credit_movement_delta: {
        Args: {
          p_kind: Database["public"]["Enums"]["credit_movement_kind"]
          p_amount: number
          p_sign: number
        }
        Returns: number
      }
      current_app_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_branch_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      customer_movements: {
        Args: {
          p_customer_id: string
        }
        Returns: {
          id: string
          kind: Database["public"]["Enums"]["credit_movement_kind"]
          amount: number
          delta: number
          note: string
          sale_id: string
          occurred_at: string
          user_name: string
        }[]
      }
      default_branch_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      effective_expiry_date: {
        Args: {
          manufacturer_expiry: string
          opened_at_value: string
          shelf_life_days: number
        }
        Returns: string
      }
      effective_sale_price: {
        Args: {
          p_presentation_id: string
          p_branch_id: string
        }
        Returns: number
      }
      fraction_stock: {
        Args: {
          p_origin_lot_id: string
          p_target_presentation_id: string
          p_packets_num: number
          p_grams_needed: number
          p_merma: number
          p_new_origin_quantity: number
          p_origin_lot_status: Database["public"]["Enums"]["stock_lot_status"]
        }
        Returns: undefined
      }
      get_next_internal_code_seq: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      is_administrator: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_api_role: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      merge_classifier: {
        Args: {
          p_kind: string
          p_from_id: string
          p_into_id: string
        }
        Returns: number
      }
      open_stock_lot: {
        Args: {
          p_lot_id: string
        }
        Returns: undefined
      }
      price_batch_changes: {
        Args: {
          p_batch_id: string
        }
        Returns: {
          presentation_id: string
          product_id: string
          product_name: string
          presentation_name: string
          internal_barcode: string
          old_price: number
          new_price: number
          changed_at: string
          sold_by_weight: boolean
        }[]
      }
      process_offline_sale: {
        Args: {
          payload: Json
        }
        Returns: boolean
      }
      quick_restock: {
        Args: {
          p_presentation_id: string
          p_product_id: string
          p_quantity: number
          p_expiry_date: string
          p_purchase_cost?: number
          p_branch_id?: string
        }
        Returns: string
      }
      resolve_stock_warning: {
        Args: {
          p_warning_id: string
          p_resolution: string
        }
        Returns: undefined
      }
      resolve_work_branch: {
        Args: {
          p_branch_id: string
        }
        Returns: string
      }
      save_supplier_product_cost: {
        Args: {
          p_product_id: string
          p_supplier_id: string
          p_cost: number
          p_purchase_quantity: number
          p_supplier_product_code?: string
          p_is_primary?: boolean
        }
        Returns: undefined
      }
      set_branch_price: {
        Args: {
          p_presentation_id: string
          p_branch_id: string
          p_price: number
        }
        Returns: undefined
      }
      set_presentation_scale: {
        Args: {
          p_presentation_id: string
          p_sold_by_weight: boolean
          p_price_per_kg?: number
          p_convert?: boolean
        }
        Returns: undefined
      }
      shift_totals: {
        Args: {
          p_shift_id: string
        }
        Returns: {
          payment_method: Database["public"]["Enums"]["payment_method"]
          sales_count: number
          total: number
        }[]
      }
      stock_transfers_list: {
        Args: {
          p_branch_id?: string
          p_limit?: number
        }
        Returns: {
          id: string
          created_at: string
          product_name: string
          presentation_name: string
          quantity: number
          base_unit: string
          from_branch_name: string
          to_branch_name: string
          user_name: string
          note: string
          from_lot_id: string
          to_lot_id: string
        }[]
      }
      stock_warnings_for_review: {
        Args: {
          p_include_resolved?: boolean
          p_branch_id?: string
        }
        Returns: {
          id: string
          created_at: string
          message: string
          lot_id: string
          product_name: string
          presentation_name: string
          lot_current_quantity: number
          sale_id: string
          sale_occurred_at: string
          sale_total: number
          register_name: string
          sold_by: string
          resolved_at: string
          resolved_by_name: string
          resolution: string
          branch_id: string
          branch_name: string
        }[]
      }
      sync_offline_customer: {
        Args: {
          p_id: string
          p_name: string
          p_phone: string
          p_credit_limit: number
        }
        Returns: undefined
      }
      transfer_stock: {
        Args: {
          p_lot_id: string
          p_to_branch_id: string
          p_quantity: number
          p_note?: string
          p_local_id?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "administrator" | "employee"
      base_unit: "gram" | "millilitre" | "unit"
      credit_movement_kind: "charge" | "payment" | "adjustment"
      offline_operation_kind: "sale" | "stock_movement" | "credit_movement" | "missing_item"
      payment_method: "cash" | "transfer" | "qr" | "credit"
      sale_status: "closed" | "voided"
      stock_lot_status: "open" | "closed"
      stock_movement_kind: "receipt" | "sale" | "portioning" | "waste" | "adjustment" | "discard" | "transfer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"]
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T]

