/**
 * RF-60: cómo se muestra cada cambio del historial. El trigger guarda los valores como
 * JSON (los numéricos llegan como texto, "9500.00"); acá se vuelven legibles.
 */
import type { Json } from "../../shared/supabase/database.types";
import { formatMoney } from "../pos/money";

export const ENTITY_LABELS: Record<string, string> = {
  products: "Producto",
  product_presentations: "Presentación",
  brands: "Marca",
  categories: "Rubro",
  labels: "Etiqueta",
  customers: "Cliente",
  sales: "Venta"
};

export const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  sale_price: "Precio de venta",
  active: "Activo",
  archived_at: "Archivado",
  brand_id: "Marca",
  category_id: "Rubro",
  parent_id: "Rubro padre",
  base_quantity: "Cantidad base",
  base_unit: "Unidad base",
  internal_barcode: "Código interno",
  manufacturer_barcode: "Código del fabricante",
  price_multiplier: "Multiplicador",
  open_shelf_life_days: "Vida útil abierto (días)",
  label_text: "Texto de etiqueta",
  phone: "Teléfono",
  credit_limit: "Tope de fiado",
  status: "Estado",
  total_amount: "Total",
  payment_method: "Medio de pago"
};

const MONEY_FIELDS = new Set(["sale_price", "credit_limit", "total_amount"]);

export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity;
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Valor legible: dinero con formato, booleanos en castellano, vacío como "—". */
export function formatValue(field: string, value: Json | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (MONEY_FIELDS.has(field)) {
    const n = Number(value);
    if (Number.isFinite(n)) return formatMoney(n);
  }
  if (field === "archived_at" && typeof value === "string") return new Date(value).toLocaleString("es-AR");
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

export interface AuditFilters {
  text: string;
  entity: string;
  userId: string;
  from: string; // yyyy-mm-dd
  to: string;   // yyyy-mm-dd (inclusive)
}

export const EMPTY_FILTERS: AuditFilters = { text: "", entity: "", userId: "", from: "", to: "" };

/** Argumentos de la RPC: fechas locales → rango [desde 00:00, hasta+1 00:00). */
export function toSearchArgs(filters: AuditFilters, limit = 200): {
  p_text?: string; p_entity?: string; p_user_id?: string; p_from?: string; p_to?: string; p_limit: number;
} {
  const args: ReturnType<typeof toSearchArgs> = { p_limit: limit };
  if (filters.text.trim()) args.p_text = filters.text.trim();
  if (filters.entity) args.p_entity = filters.entity;
  if (filters.userId) args.p_user_id = filters.userId;
  if (filters.from) args.p_from = new Date(`${filters.from}T00:00:00`).toISOString();
  if (filters.to) {
    const end = new Date(`${filters.to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    args.p_to = end.toISOString();
  }
  return args;
}
