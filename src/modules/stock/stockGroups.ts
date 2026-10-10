export interface StockLotGroupIdentity {
  presentation_id: string;
  branch_id: string | null;
}

export interface StockLotGroup<T> {
  key: string;
  lots: T[];
}

/** Agrupa solo lotes de la misma presentación y sucursal; los lotes siguen separados. */
export function groupStockLots<T extends StockLotGroupIdentity>(lots: T[]): StockLotGroup<T>[] {
  const groups = new Map<string, StockLotGroup<T>>();
  for (const lot of lots) {
    const key = `${lot.branch_id ?? "sin-sucursal"}:${lot.presentation_id}`;
    const group = groups.get(key) ?? { key, lots: [] };
    group.lots.push(lot);
    groups.set(key, group);
  }
  return Array.from(groups.values());
}
