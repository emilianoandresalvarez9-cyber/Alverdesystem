/** RF-68: validación de un traspaso entre sucursales antes de mandarlo. Lógica pura. */
import { parseStockQuantity } from "./quantityInput";

export type TransferCheck =
  | { ok: true; quantity: number }
  | { ok: false; reason: string };

export function checkTransfer(input: {
  rawQuantity: string;
  available: number;
  fromBranchId: string | null;
  toBranchId: string;
}): TransferCheck {
  if (!input.toBranchId) return { ok: false, reason: "Elegí la sucursal de destino." };
  if (input.fromBranchId && input.toBranchId === input.fromBranchId) {
    return { ok: false, reason: "El lote ya está en esa sucursal." };
  }
  const parsed = parseStockQuantity(input.rawQuantity, "Indicá cuánto traspasar.");
  if (!parsed.ok) return parsed;
  const quantity = parsed.quantity;
  if (quantity > input.available) return { ok: false, reason: `No alcanza: el lote tiene ${input.available}.` };
  return { ok: true, quantity };
}
