import type { AppSupabaseClient } from "../../shared/supabase/client";
import type { QueuedOperation } from "../../shared/offline/types";
import { formatQuantity } from "../stock/format";
import type { CartLine, SalePayload } from "./types";

export interface GranelShortage {
  presentationId: string;
  label: string;
  baseUnit: string;
  needed: number;
  available: number;
}

/**
 * RF-38 (decisión de la dueña): el granel no admite faltante. Lo que lleva la venta de cada
 * presentación de Balanza se compara con el stock de la sucursal menos lo vendido en este equipo
 * que todavía no llegó a la nube. Las ventas rechazadas no cuentan: no descontaron nada.
 */
export function granelShortages(lines: CartLine[], stock: Map<string, number>, pending: QueuedOperation[]): GranelShortage[] {
  const needed = new Map<string, { line: CartLine; quantity: number }>();
  for (const line of lines) {
    if (!line.entry.soldByWeight) continue;
    const current = needed.get(line.entry.presentationId);
    needed.set(line.entry.presentationId, { line, quantity: (current?.quantity ?? 0) + line.quantity });
  }

  const unsent = new Map<string, number>();
  for (const operation of pending) {
    if (operation.kind !== "sale" || operation.retryable === false) continue;
    for (const item of (operation.payload as unknown as Partial<SalePayload>).items ?? []) {
      if (needed.has(item.presentationId)) unsent.set(item.presentationId, (unsent.get(item.presentationId) ?? 0) + Number(item.quantity));
    }
  }

  const shortages: GranelShortage[] = [];
  for (const [presentationId, { line, quantity }] of needed) {
    const available = (stock.get(presentationId) ?? 0) - (unsent.get(presentationId) ?? 0);
    if (quantity > available + 1e-9) {
      shortages.push({
        presentationId,
        label: `${line.entry.productName} · ${line.entry.presentationName}`,
        baseUnit: line.entry.baseUnit,
        needed: quantity,
        available: Math.max(0, available)
      });
    }
  }
  return shortages;
}

export function shortageMessage(shortages: GranelShortage[]): string {
  const detail = shortages
    .map((s) => `${s.label}: quedan ${formatQuantity(s.available, s.baseUnit)} y la venta lleva ${formatQuantity(s.needed, s.baseUnit)}`)
    .join("; ");
  return `No alcanza el granel (${detail}). Corregí la pesada o sacala de la venta: el granel no admite faltante.`;
}

/**
 * Consulta el stock de la sucursal para el granel del carrito. Devuelve el aviso si no alcanza, o
 * null si alcanza o si no se pudo consultar: sin respuesta de la nube decide la base al sincronizar.
 */
export async function checkGranelStock(
  client: AppSupabaseClient,
  lines: CartLine[],
  branchId: string | null,
  pending: QueuedOperation[]
): Promise<string | null> {
  const ids = [...new Set(lines.filter((line) => line.entry.soldByWeight).map((line) => line.entry.presentationId))];
  if (ids.length === 0) return null;

  const { data, error } = await client
    .from("employee_stock_lots")
    .select("presentation_id, current_quantity, branch_id")
    .in("presentation_id", ids);
  if (error || !data) return null;

  const stock = new Map<string, number>();
  for (const row of data) {
    if (!row.presentation_id || (branchId && row.branch_id !== branchId)) continue;
    stock.set(row.presentation_id, (stock.get(row.presentation_id) ?? 0) + Number(row.current_quantity ?? 0));
  }
  const shortages = granelShortages(lines, stock, pending);
  return shortages.length > 0 ? shortageMessage(shortages) : null;
}
