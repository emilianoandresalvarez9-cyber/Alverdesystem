/** RF-27: historial de precios por producto, para seguir la inflación. Lógica pura. */

export interface PriceHistoryRow {
  id: string;
  presentation_id: string;
  sale_price: number | string;
  previous_price: number | string | null;
  changed_at: string;
  changed_by: string | null;
  batch_id: string | null;
  /** RF-69: null = precio base; un id = precio propio de esa sucursal. */
  branch_id?: string | null;
  profile: { display_name: string } | { display_name: string }[] | null;
}

export interface PriceHistoryEntry {
  id: string;
  presentationId: string;
  price: number;
  previousPrice: number | null;
  /** Variación sobre el precio anterior, en proporción (0.1 = +10 %); null si no hay anterior. */
  change: number | null;
  changedAt: string;
  changedBy: string;
  fromBulkUpdate: boolean;
  branchId: string | null;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

/** Ordena del más reciente al más viejo y calcula la variación contra el anterior. */
export function toPriceHistory(rows: PriceHistoryRow[]): PriceHistoryEntry[] {
  return [...rows]
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
    .map((row) => {
      const price = Number(row.sale_price);
      const previous = row.previous_price === null ? null : Number(row.previous_price);
      return {
        id: row.id,
        presentationId: row.presentation_id,
        price,
        previousPrice: previous,
        change: previous !== null && previous > 0 ? (price - previous) / previous : null,
        changedAt: row.changed_at,
        changedBy: one(row.profile)?.display_name ?? "—",
        fromBulkUpdate: row.batch_id !== null,
        branchId: row.branch_id ?? null
      };
    });
}

/** Variación acumulada entre el precio más viejo y el más nuevo del historial (inflación del producto). */
export function accumulatedChange(entries: PriceHistoryEntry[]): number | null {
  if (entries.length < 2) return null;
  const newest = entries[0]!.price;
  const oldest = entries[entries.length - 1]!.previousPrice ?? entries[entries.length - 1]!.price;
  return oldest > 0 ? (newest - oldest) / oldest : null;
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const pct = Math.round(value * 1000) / 10;
  return `${pct > 0 ? "+" : ""}${pct.toLocaleString("es-AR")} %`;
}

/** Agrupa por precio (base y cada sucursal): la variación acumulada no mezcla precios distintos. */
export function groupByBranch(entries: PriceHistoryEntry[]): { branchId: string | null; entries: PriceHistoryEntry[] }[] {
  const groups = new Map<string | null, PriceHistoryEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.branchId) ?? [];
    list.push(e);
    groups.set(e.branchId, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : 0))
    .map(([branchId, list]) => ({ branchId, entries: list }));
}
