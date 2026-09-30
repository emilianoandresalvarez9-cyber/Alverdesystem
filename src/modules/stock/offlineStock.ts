import {
  enqueueOperation,
  pendingOperations,
  subscribeToQueueChanges,
} from "../../shared/offline/queue";
import { synchronizePendingOperations } from "../../shared/offline/sync";
import type { QueuedOperation } from "../../shared/offline/types";
import type { StockLot } from "./types";

export type StockOfflinePayload = Record<string, unknown> & { action: string };

export async function queueStockOperation(payload: StockOfflinePayload, userId: string): Promise<{
  localId: string;
  synchronized: boolean;
  failureMessage?: string;
}> {
  if (!userId) throw new Error("Sesión requerida para registrar stock.");

  const operation = await enqueueOperation({
    kind: "stock_movement",
    payload: { ...payload, userId },
  });

  if (navigator.onLine) {
    // Do not make the UI wait for a network request after the durable local write.
    // Slow or flaky connections leave the item queued and the global sync retries it.
    void synchronizePendingOperations().catch(() => {});
  }

  const pending = (await pendingOperations()).find((candidate) => candidate.localId === operation.localId);
  return {
    localId: operation.localId,
    synchronized: !pending,
    failureMessage: pending?.failureMessage,
  };
}

/** Notify a form when the server acknowledges its queued operation. */
export function watchStockOperationSync(localId: string, onSynced: () => void): () => void {
  let active = true;
  let notified = false;
  let unsubscribe = () => {};

  const check = () => {
    void pendingOperations().then((pending) => {
      if (active && !notified && !pending.some((operation) => operation.localId === localId)) {
        notified = true;
        unsubscribe();
        onSynced();
      }
    }).catch(() => {
      // A temporary IndexedDB read failure must not turn a queued operation into success.
    });
  };

  unsubscribe = subscribeToQueueChanges(check);
  check();
  return () => {
    active = false;
    unsubscribe();
  };
}

type StockPayload = {
  action?: string;
  lotId?: string;
  originLotId?: string;
  targetPresentationId?: string;
  productId?: string;
  productName?: string;
  presentationName?: string;
  baseUnit?: string;
  baseQuantity?: number;
  soldByWeight?: boolean;
  openShelfLifeDays?: number | null;
  quantity?: number;
  expiryDate?: string | null;
  packetsNum?: number;
  newOriginQuantity?: number;
  originLotStatus?: "open" | "closed";
  openedAt?: string | null;
};

function pendingLot(payload: StockPayload, operation: QueuedOperation, presentationId: string, quantity: number): StockLot {
  const expiry = typeof payload.expiryDate === "string" ? payload.expiryDate : null;
  return {
    id: `pending:${operation.localId}`,
    presentation_id: presentationId,
    supplier_id: null,
    initial_quantity: quantity,
    current_quantity: quantity,
    received_at: operation.createdAt,
    manufacturer_expiry_date: expiry,
    opened_at: payload.action === "open_lot" ? operation.createdAt : null,
    portioned_at: payload.action === "fraction_stock" ? operation.createdAt : null,
    status: "open",
    created_at: operation.createdAt,
    product_id: String(payload.productId ?? ""),
    product_name: String(payload.productName ?? "Producto pendiente"),
    presentation_name: String(payload.presentationName ?? "Presentación pendiente"),
    base_unit: String(payload.baseUnit ?? "unit"),
    base_quantity: Number(payload.baseQuantity ?? 1),
    sold_by_weight: Boolean(payload.soldByWeight),
    open_shelf_life_days: payload.openShelfLifeDays ?? null,
    supplier_name: null,
    effective_expiry_date: expiry,
    expiry_status: "indeterminate",
    days_until_expiry: null,
  };
}

/** Applies only this device's pending intents as a display overlay; the server remains authoritative. */
export function withPendingStockOperations(lots: StockLot[], operations: QueuedOperation[]): StockLot[] {
  const result = new Map(lots.map((lot) => [lot.id, { ...lot }]));

  for (const operation of operations) {
    if (operation.kind !== "stock_movement") continue;
    const payload = operation.payload as StockPayload;

    if (payload.action === "quick_restock" && payload.targetPresentationId && typeof payload.quantity === "number") {
      const id = `pending:${operation.localId}`;
      if (!result.has(id)) result.set(id, pendingLot(payload, operation, payload.targetPresentationId, payload.quantity));
      continue;
    }

    if (payload.action === "fraction_stock") {
      const origin = payload.originLotId ? result.get(payload.originLotId) : undefined;
      if (origin && typeof payload.newOriginQuantity === "number") {
        origin.current_quantity = payload.newOriginQuantity;
        origin.status = payload.originLotStatus ?? origin.status;
      }
      if (payload.targetPresentationId && typeof payload.packetsNum === "number") {
        const id = `pending:${operation.localId}`;
        if (!result.has(id)) result.set(id, pendingLot(payload, operation, payload.targetPresentationId, payload.packetsNum));
      }
      continue;
    }

    const lot = payload.lotId ? result.get(payload.lotId) : undefined;
    if (!lot) continue;
    if (payload.action === "open_lot") {
      lot.opened_at ??= operation.createdAt;
    } else if (payload.action === "adjust_stock" && typeof payload.quantity === "number") {
      lot.current_quantity = Math.max(0, Number((lot.current_quantity + payload.quantity).toFixed(3)));
      if (lot.current_quantity === 0) lot.status = "closed";
    }
  }

  return Array.from(result.values());
}

