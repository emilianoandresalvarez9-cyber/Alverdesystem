export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
}

export interface MissingItemProduct {
  id: string;
  name: string;
  manufacturer_barcode: string | null;
  base_unit: string;
}

export interface MissingItem {
  id: string;
  product_id: string;
  reported_by: string;
  note: string | null;
  resolved: boolean;
  created_at: string;
  /** RF-70: sucursal donde falta. */
  branch_id: string | null;
  branch_name: string | null;
  product?: MissingItemProduct;
  supplier?: Supplier | null;
}

export interface PresentationLookupResult {
  presentation_id: string;
  presentation_name: string;
  product_id: string;
  product_name: string;
  base_quantity: number;
  sale_price: number;
  internal_barcode: string | null;
  manufacturer_barcode: string | null;
  base_unit?: "gram" | "millilitre" | "unit";
  sold_by_weight?: boolean;
  open_shelf_life_days?: number | null;
}

