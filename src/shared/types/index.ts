export interface Brand {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  manufacturer_barcode?: string | null;
  brand_id?: string | null;
  category_id?: string | null;
  base_unit?: string;
  active: boolean;
}

export interface Presentation {
  id: string;
  product_id: string;
  name: string;
  sale_price: number;
  internal_code?: string;
  barcode?: string;
  status: string;
  base_quantity?: number;
}

export interface StockLot {
  id: string;
  presentation_id: string;
  initial_quantity: number;
  current_quantity: number;
  cost: number;
  received_at: string;
  manufacturer_expiry_date?: string | null;
  opened_at?: string | null;
  status: string;
}

export interface Sale {
  id: string;
  local_id: string;
  total_amount: number;
  payment_method: string;
  occurred_at: string;
  status: string;
  user_id?: string;
  customer_id?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  presentation_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Customer {
  id: string;
  name: string;
  contact?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
}


export type SupabaseAny = ReturnType<typeof JSON.parse>;
