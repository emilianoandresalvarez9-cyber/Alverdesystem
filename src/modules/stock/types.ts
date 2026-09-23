export type StockLotStatus = "open" | "closed";

export type StockMovementKind =
  | "receipt"
  | "sale"
  | "portioning"
  | "waste"
  | "adjustment"
  | "discard";

export type LotExpiryStatus = "expired" | "critical" | "warning" | "good" | "indeterminate";

export interface StockLot {
  id: string;
  presentation_id: string;
  supplier_id: string | null;
  initial_quantity: number;
  current_quantity: number;
  purchase_cost: number;
  received_at: string;
  manufacturer_expiry_date: string | null;
  opened_at: string | null;
  portioned_at: string | null;
  status: StockLotStatus;
  created_at: string;
  
  // Metadatos calculados de producto / presentación
  product_id: string;
  product_name: string;
  presentation_name: string;
  base_unit: string;
  base_quantity: number;
  open_shelf_life_days: number | null;
  supplier_name: string | null;

  // Calculados dinámicamente por lógica de vencimiento efectivo (RF-08)
  effective_expiry_date: string | null;
  expiry_status: LotExpiryStatus;
  days_until_expiry: number | null;
}

export interface FefoAllocationItem {
  lotId: string;
  quantityToDeduct: number;
  remainingInLot: number;
  shouldClose: boolean;
  effectiveExpiryDate: string | null;
}

export interface FefoAllocationResult {
  requestedQuantity: number;
  allocatedQuantity: number;
  fulfilled: boolean;
  missingQuantity: number;
  items: FefoAllocationItem[];
}

export interface StockAdjustmentInput {
  lotId: string;
  productId: string;
  kind: "waste" | "adjustment" | "discard";
  quantity: number;
  reason: string;
}

export interface StockLotFilters {
  search: string;
  status: "all" | "open" | "closed";
  expiryStatus: "all" | "expired" | "critical" | "warning" | "good";
  sortBy: "effective_expiry" | "received_at" | "name";
}
