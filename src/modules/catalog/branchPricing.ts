/**
 * RF-69: precio de una presentación en una sucursal. Lógica pura.
 * sale_price es el precio BASE; branch_prices tiene el precio propio de cada sucursal
 * (solo donde difiere). Sin sucursal (o sin precio propio) rige el base.
 */
export interface PricedPresentation {
  sale_price: number;
  branch_prices?: Record<string, number> | null;
}

export function effectivePrice(presentation: PricedPresentation, branchId: string | null | undefined): number {
  const own = branchId ? presentation.branch_prices?.[branchId] : undefined;
  return own === undefined || own === null ? presentation.sale_price : Number(own);
}

export function hasOwnPrice(presentation: PricedPresentation, branchId: string | null | undefined): boolean {
  return !!branchId && presentation.branch_prices?.[branchId] !== undefined;
}

/** Normaliza lo que llega de la vista (jsonb con números como texto o número). */
export function parseBranchPrices(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [branchId, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value);
    if (Number.isFinite(n)) out[branchId] = n;
  }
  return out;
}
