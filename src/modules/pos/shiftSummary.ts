import type { QueuedOperation } from "../../shared/offline/types";
import { sumMoney } from "./money";
import { PAYMENT_METHODS, type PaymentMethod, type SalePayload } from "./types";

export type ShiftSummary = {
  byMethod: Record<PaymentMethod, { count: number; total: number }>;
  total: number;
  salesCount: number;
  pendingSync: number;
};

/**
 * RF-32 · Totales del turno por medio de pago, calculados desde la cola local del dispositivo.
 * Funciona sin conexión: toda venta de este puesto pasa primero por la cola (RF-35).
 */
export function summarizeShift(operations: QueuedOperation[], shiftId: string): ShiftSummary {
  const byMethod = Object.fromEntries(
    PAYMENT_METHODS.map((method) => [method, { count: 0, total: 0 }])
  ) as ShiftSummary["byMethod"];
  let pendingSync = 0;
  let salesCount = 0;

  for (const operation of operations) {
    if (operation.kind !== "sale") continue;
    const payload = operation.payload as unknown as Partial<SalePayload>;
    if (payload.shiftId !== shiftId || !payload.paymentMethod || !(payload.paymentMethod in byMethod)) continue;

    const bucket = byMethod[payload.paymentMethod];
    bucket.count += 1;
    bucket.total = sumMoney([bucket.total, Number(payload.totalAmount ?? 0)]);
    salesCount += 1;
    if (!operation.syncedAt) pendingSync += 1;
  }

  return {
    byMethod,
    total: sumMoney(PAYMENT_METHODS.map((method) => byMethod[method].total)),
    salesCount,
    pendingSync
  };
}
