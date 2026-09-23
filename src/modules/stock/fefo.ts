import type { StockLot, FefoAllocationResult, FefoAllocationItem } from "./types";

/**
 * RF-09: Algoritmo FEFO (First-Expired, First-Out).
 * Al vender o fraccionar, el sistema descuenta automáticamente del lote
 * que vence más próximo, sin que el empleado tenga que elegirlo manualmente.
 *
 * Criterio de ordenamiento:
 * 1. Fecha de vencimiento efectivo más próxima (menor a mayor).
 * 2. Lotes sin fecha de vencimiento van al final.
 * 3. A igualdad de vencimiento, desempata por fecha de ingreso (FIFO: más antiguo primero).
 */
export function allocateByFefo(
  lots: StockLot[],
  requestedQuantity: number
): FefoAllocationResult {
  if (requestedQuantity <= 0) {
    return {
      requestedQuantity: 0,
      allocatedQuantity: 0,
      fulfilled: true,
      missingQuantity: 0,
      items: [],
    };
  }

  // Filtrar solo lotes abiertos con stock disponible
  const availableLots = lots.filter(
    (lot) => lot.status === "open" && lot.current_quantity > 0
  );

  // Ordenar según FEFO
  const sortedLots = [...availableLots].sort((a, b) => {
    // 1. Comparar vencimiento efectivo
    if (a.effective_expiry_date && b.effective_expiry_date) {
      if (a.effective_expiry_date !== b.effective_expiry_date) {
        return a.effective_expiry_date.localeCompare(b.effective_expiry_date);
      }
    } else if (a.effective_expiry_date && !b.effective_expiry_date) {
      return -1; // Con fecha va primero
    } else if (!a.effective_expiry_date && b.effective_expiry_date) {
      return 1; // Sin fecha va después
    }

    // 2. Desempate por fecha de recepción (FIFO)
    return a.received_at.localeCompare(b.received_at);
  });

  let remainingToAllocate = requestedQuantity;
  const items: FefoAllocationItem[] = [];

  for (const lot of sortedLots) {
    if (remainingToAllocate <= 0) break;

    const quantityToDeduct = Math.min(lot.current_quantity, remainingToAllocate);
    const remainingInLot = Number((lot.current_quantity - quantityToDeduct).toFixed(3));
    const shouldClose = remainingInLot <= 0.0001;

    items.push({
      lotId: lot.id,
      quantityToDeduct: Number(quantityToDeduct.toFixed(3)),
      remainingInLot,
      shouldClose,
      effectiveExpiryDate: lot.effective_expiry_date,
    });

    remainingToAllocate = Number((remainingToAllocate - quantityToDeduct).toFixed(3));
  }

  const allocatedQuantity = Number((requestedQuantity - remainingToAllocate).toFixed(3));
  const fulfilled = remainingToAllocate <= 0.0001;

  return {
    requestedQuantity,
    allocatedQuantity,
    fulfilled,
    missingQuantity: Math.max(0, remainingToAllocate),
    items,
  };
}
