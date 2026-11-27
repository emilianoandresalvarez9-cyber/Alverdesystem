// Sitio público: lista de precios y disponibilidad en vivo (public_price_list / public_branches).
// Sólo lo que la base publica: nunca costos, cantidades ni lotes (RNF-04).
import { formatMoney } from "../pos/money";
import { presentationPriceLabel } from "../catalog/scalePricing";
import type { BadgeTone } from "../../shared/ui";

export type Availability = "disponible" | "ultimas" | "sin_stock";

/** Fila tal como la devuelve `public_price_list` (marca y rubro pueden faltar). */
export type PriceRow = {
  presentation_id: string;
  product_id: string;
  product_name: string;
  brand_name: string | null;
  category_name: string | null;
  presentation_name: string;
  sold_by_weight: boolean;
  price: number | string;
  availability: string;
};

export type PublicPresentation = {
  id: string;
  name: string;
  soldByWeight: boolean;
  price: number;
  availability: Availability;
};

export type PublicProduct = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  presentations: PublicPresentation[];
};

export type PublicBranch = { id: string; name: string; address: string | null };

/** Ante un valor que el sitio no conoce, lo más prudente: no prometer stock. */
export function parseAvailability(value: unknown): Availability {
  return value === "disponible" || value === "ultimas" ? value : "sin_stock";
}

/** Agrupa las filas por producto, en el orden en que llegan (la base ordena por nombre). */
export function groupProducts(rows: readonly PriceRow[]): PublicProduct[] {
  const byId = new Map<string, PublicProduct>();
  for (const row of rows) {
    const price = Number(row.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    let product = byId.get(row.product_id);
    if (!product) {
      product = { id: row.product_id, name: row.product_name, brand: row.brand_name || null, category: row.category_name || null, presentations: [] };
      byId.set(row.product_id, product);
    }
    product.presentations.push({
      id: row.presentation_id,
      name: row.presentation_name,
      soldByWeight: Boolean(row.sold_by_weight),
      price,
      availability: parseAvailability(row.availability)
    });
  }
  return [...byId.values()];
}

/** Sin acentos ni mayúsculas: «cafe» encuentra «Café». */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export type PriceListFilters = { search: string; category: string; onlyAvailable: boolean };

export const EMPTY_PRICE_FILTERS: PriceListFilters = { search: "", category: "", onlyAvailable: false };

/** Busca por producto, marca, rubro o presentación; filtra por rubro y por «hay stock». */
export function filterProducts(products: readonly PublicProduct[], filters: PriceListFilters): PublicProduct[] {
  const words = normalizeText(filters.search).split(/\s+/).filter(Boolean);
  const result: PublicProduct[] = [];
  for (const product of products) {
    if (filters.category && product.category !== filters.category) continue;
    const presentations = filters.onlyAvailable
      ? product.presentations.filter((p) => p.availability !== "sin_stock")
      : product.presentations;
    if (presentations.length === 0) continue;
    const haystack = normalizeText([product.name, product.brand ?? "", product.category ?? "", ...presentations.map((p) => p.name)].join(" "));
    if (!words.every((word) => haystack.includes(word))) continue;
    result.push(presentations === product.presentations ? product : { ...product, presentations });
  }
  return result;
}

/** Rubros presentes en la lista, en orden alfabético. */
export function categoriesOf(products: readonly PublicProduct[]): string[] {
  const names = new Set<string>();
  for (const product of products) if (product.category) names.add(product.category);
  return [...names].sort((a, b) => a.localeCompare(b, "es"));
}

const AVAILABILITY: Record<Availability, { text: string; tone: BadgeTone }> = {
  disponible: { text: "Disponible", tone: "exito" },
  ultimas: { text: "Últimas unidades", tone: "aviso" },
  sin_stock: { text: "Sin stock", tone: "neutro" }
};

/** Texto y tono del estado. En balanza no hay «unidades»: quedan pocos gramos. */
export function availabilityBadge(presentation: Pick<PublicPresentation, "availability" | "soldByWeight">): { text: string; tone: BadgeTone } {
  if (presentation.availability === "ultimas" && presentation.soldByWeight) return { text: "Queda poco", tone: "aviso" };
  return AVAILABILITY[presentation.availability];
}

/** `$4.000` por unidad; en balanza, `$3.500/kg` (la base guarda el precio por gramo, ADR-001). */
export function priceText(presentation: Pick<PublicPresentation, "price" | "soldByWeight">): string {
  return presentationPriceLabel({ sale_price: presentation.price, sold_by_weight: presentation.soldByWeight }, formatMoney);
}

/** «Actualizado recién», «hace 1 minuto», «hace 12 minutos», «hace más de una hora». */
export function updatedLabel(updatedAt: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - updatedAt) / 60_000);
  if (minutes < 1) return "Actualizado recién";
  if (minutes === 1) return "Actualizado hace 1 minuto";
  if (minutes < 60) return `Actualizado hace ${minutes} minutos`;
  return "Actualizado hace más de una hora";
}

export function countText(visible: number, total: number): string {
  const noun = visible === 1 ? "producto" : "productos";
  return visible < total ? `${visible} ${noun} de ${total}` : `${visible} ${noun}`;
}

/**
 * Presentaciones cuyo precio o disponibilidad cambió entre dos listas de la misma sucursal: el
 * sitio las resalta un instante. La primera lista no resalta nada (no hay con qué comparar).
 */
export function changedPresentations(previous: readonly PublicProduct[] | null, next: readonly PublicProduct[]): Set<string> {
  const changed = new Set<string>();
  if (!previous) return changed;
  const before = new Map<string, string>();
  for (const product of previous) for (const p of product.presentations) before.set(p.id, `${p.price}|${p.availability}`);
  for (const product of next) {
    for (const p of product.presentations) {
      const old = before.get(p.id);
      if (old !== undefined && old !== `${p.price}|${p.availability}`) changed.add(p.id);
    }
  }
  return changed;
}
