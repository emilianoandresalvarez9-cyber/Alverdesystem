/** RF-68: validación de un traspaso entre sucursales antes de mandarlo. Lógica pura. */

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
  const quantity = Number(input.rawQuantity.trim().replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, reason: "Indicá cuánto traspasar." };
  if (Math.round(quantity * 1000) !== quantity * 1000) return { ok: false, reason: "Hasta tres decimales." };
  if (quantity > input.available) return { ok: false, reason: `No alcanza: el lote tiene ${input.available}.` };
  return { ok: true, quantity };
}
