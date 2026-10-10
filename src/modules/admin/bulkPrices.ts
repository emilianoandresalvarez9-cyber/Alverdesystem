/**
 * RF-28 / RF-30: lógica pura de la actualización masiva de precios.
 * La base calcula y aplica (RPC bulk_update_prices); acá solo se valida la entrada,
 * se resume la vista previa y se arma la lista de reetiquetado.
 */
import { formatMoney } from "../pos/money";

export type PriceScope = "all" | "brand" | "category" | "supplier";

export const SCOPE_LABELS: Record<PriceScope, string> = {
  all: "Todo el catálogo",
  brand: "Una marca",
  category: "Un rubro",
  supplier: "Un proveedor"
};

export interface PriceChange {
  presentation_id: string;
  product_id: string;
  product_name: string;
  presentation_name: string;
  old_price: number;
  new_price: number;
  /** Balanza (ADR-001): el precio viene por gramo; se muestra y exporta por kilo. */
  sold_by_weight: boolean;
}

export interface RetagRow extends PriceChange {
  internal_barcode: string | null;
  changed_at: string;
}

export type PercentResult = { ok: true; percent: number } | { ok: false; reason: string };

/** Acepta "10", "-5", "12,5". Rechaza 0, menores o iguales a -100 y texto. */
export function parsePercent(raw: string): PercentResult {
  const value = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(value)) return { ok: false, reason: "Ingresá un porcentaje, por ejemplo 10 o -5." };
  if (value === 0) return { ok: false, reason: "El porcentaje tiene que ser distinto de cero." };
  if (value <= -100) return { ok: false, reason: "No se puede bajar un 100 % o más." };
  return { ok: true, percent: value };
}

export interface PreviewSummary {
  count: number;
  increases: number;
  decreases: number;
  oldTotal: number;
  newTotal: number;
}

export function summarizePreview(rows: PriceChange[]): PreviewSummary {
  return rows.reduce<PreviewSummary>(
    (acc, row) => ({
      count: acc.count + 1,
      increases: acc.increases + (row.new_price > row.old_price ? 1 : 0),
      decreases: acc.decreases + (row.new_price < row.old_price ? 1 : 0),
      oldTotal: acc.oldTotal + row.old_price,
      newTotal: acc.newTotal + row.new_price
    }),
    { count: 0, increases: 0, decreases: 0, oldTotal: 0, newTotal: 0 }
  );
}

export const RETAG_HEADERS = ["Producto", "Presentación", "Código interno", "Precio anterior", "Precio nuevo", "Por"];

/** Precio tal como lo piensa la dueña: por kilo en balanza, por unidad en el resto. */
export function displayPrice(price: number, soldByWeight: boolean): number {
  return soldByWeight ? Math.round(price * 100000) / 100 : price;
}

export function formatPrice(price: number, soldByWeight: boolean): string {
  return `${formatMoney(displayPrice(price, soldByWeight))}${soldByWeight ? "/kg" : ""}`;
}

/** Filas para el Excel de reetiquetado (RF-30): solo lo que cambió. */
export function retagMatrix(rows: RetagRow[]): (string | number)[][] {
  return rows
    .filter((row) => row.old_price !== row.new_price)
    .map((row) => [
      row.product_name, row.presentation_name, row.internal_barcode ?? "",
      displayPrice(row.old_price, row.sold_by_weight), displayPrice(row.new_price, row.sold_by_weight),
      row.sold_by_weight ? "kg" : "unidad"
    ]);
}

/** "+$ 1.500,00" o "−$ 200,00". */
export function formatDiff(row: PriceChange): string {
  const diff = displayPrice(row.new_price, row.sold_by_weight) - displayPrice(row.old_price, row.sold_by_weight);
  return `${diff > 0 ? "+" : "−"}${formatMoney(Math.abs(diff))}${row.sold_by_weight ? "/kg" : ""}`;
}
