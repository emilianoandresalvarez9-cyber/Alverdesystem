/** Fila de la vista customer_accounts (saldo = suma de movimientos, RF-46). */
export interface CustomerAccount {
  id: string;
  name: string;
  phone: string | null;
  credit_limit: number | null;
  active: boolean;
  balance: number;
  last_movement_at: string | null;
}

export type CreditMovementKind = "charge" | "payment" | "adjustment";

/** Payload de la operación offline `credit_movement` (lo lee apply_offline_operation). */
export interface CreditMovementPayload {
  customerId: string;
  movementKind: CreditMovementKind;
  amount: number;
  note?: string;
  /** Solo para ajustes (RF-48): 1 sube la deuda, -1 la baja. */
  adjustmentSign?: 1 | -1;
}

export interface CreditMovementRow {
  id: string;
  kind: CreditMovementKind;
  amount: number;
  delta: number;
  note: string | null;
  sale_id: string | null;
  occurred_at: string;
  user_name: string | null;
}
