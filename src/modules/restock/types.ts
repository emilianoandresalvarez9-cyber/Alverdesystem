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
}
