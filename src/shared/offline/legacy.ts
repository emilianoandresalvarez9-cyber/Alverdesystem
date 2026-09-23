import { pendingOperations, rewritePendingOperation } from "./queue";
import type { QueuedOperation } from "./types";

const LEGACY_MISSING_PREFIX = "Faltante reportado offline";

/**
 * Hasta PR-07, un faltante marcado sin conexión se encolaba como "ajuste de stock" sin cantidad.
 * La nube no lo puede aplicar, así que quedaba pendiente para siempre. Lo convertimos al tipo
 * `missing_item` con el mismo localId, de modo que se envíe una sola vez.
 */
export function isLegacyMissingReport(operation: QueuedOperation): boolean {
  const payload = operation.payload as { movementKind?: unknown; quantity?: unknown; reason?: unknown; productId?: unknown };
  return operation.kind === "stock_movement"
    && payload.movementKind === "adjustment"
    && payload.quantity === undefined
    && typeof payload.productId === "string"
    && typeof payload.reason === "string"
    && payload.reason.startsWith(LEGACY_MISSING_PREFIX);
}

export async function upgradeLegacyOperations(): Promise<number> {
  let upgraded = 0;
  for (const operation of await pendingOperations()) {
    if (!isLegacyMissingReport(operation)) continue;
    const payload = operation.payload as { productId: string };
    const { failedAt: _failedAt, failureMessage: _failureMessage, ...rest } = operation;
    await rewritePendingOperation({
      ...rest,
      kind: "missing_item",
      payload: { productId: payload.productId, note: "Avisado sin conexión (versión anterior de la app)" }
    });
    upgraded += 1;
  }
  return upgraded;
}
