import { useEffect, useState, useCallback, useMemo } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { getDaysUntilExpiry, evaluateExpiryStatus } from "./expiry";
import type { StockLot, StockLotFilters, LotExpiryStatus } from "./types";

interface EmployeeStockLotRow {
  id: string;
  presentation_id: string;
  supplier_id: string | null;
  initial_quantity: number;
  current_quantity: number;
  received_at: string;
  manufacturer_expiry_date: string | null;
  opened_at: string | null;
  portioned_at: string | null;
  status: "open" | "closed";
  effective_expiry_date: string | null;
  product_id: string;
  product_name: string;
  base_unit: string;
  open_shelf_life_days: number | null;
  presentation_name: string;
  base_quantity: number;
  sold_by_weight: boolean;
  supplier_name: string | null;
  created_at: string;
}

const DEFAULT_FILTERS: StockLotFilters = {
  search: "",
  status: "open",
  expiryStatus: "all",
  sortBy: "effective_expiry",
};

export function useStockLots() {
  const [lots, setLots] = useState<StockLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<StockLotFilters>(DEFAULT_FILTERS);

  const setFilters = useCallback((partial: Partial<StockLotFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }, []);

  const fetchLots = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { data, error: err } = await supabase
        .from("employee_stock_lots")
        .select(`
          id, presentation_id, supplier_id, initial_quantity, current_quantity,
          received_at, manufacturer_expiry_date, opened_at, portioned_at, status,
          effective_expiry_date, product_id, product_name, base_unit,
          open_shelf_life_days, presentation_name, base_quantity, sold_by_weight,
          supplier_name, created_at
        `)
        .order("created_at", { ascending: false });

      if (err) throw err;

      const normalized: StockLot[] = ((data ?? []) as unknown as EmployeeStockLotRow[]).map((row) => {
        const days = getDaysUntilExpiry(row.effective_expiry_date);
        const status = evaluateExpiryStatus(days);

        return {
          id: row.id,
          presentation_id: row.presentation_id,
          supplier_id: row.supplier_id,
          initial_quantity: row.initial_quantity,
          current_quantity: row.current_quantity,
          received_at: row.received_at,
          manufacturer_expiry_date: row.manufacturer_expiry_date,
          opened_at: row.opened_at,
          portioned_at: row.portioned_at,
          status: row.status,
          created_at: row.created_at,

          product_id: row.product_id,
          product_name: row.product_name,
          presentation_name: row.presentation_name,
          base_unit: row.base_unit,
          base_quantity: row.base_quantity,
          sold_by_weight: row.sold_by_weight,
          open_shelf_life_days: row.open_shelf_life_days,
          supplier_name: row.supplier_name,

          effective_expiry_date: row.effective_expiry_date,
          days_until_expiry: days,
          expiry_status: status,
        };
      });

      setLots(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar los lotes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLots();
  }, [fetchLots]);

  const hasActiveOpenBag = useCallback((productId: string) => {
    return lots.some(
      (l) => l.product_id === productId && l.sold_by_weight && l.status === "open" && l.opened_at !== null && l.current_quantity > 0
    );
  }, [lots]);

  // RF-08 / RF-11: Abrir lote (registra opened_at)
  const markLotOpened = async (lotId: string) => {
    try {
      const supabase = getSupabase();
      const { error: err } = await supabase.rpc("open_stock_lot", { p_lot_id: lotId });

      if (err) throw err;
      await fetchLots();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al abrir el lote.";
      setError(msg.includes("Regla de oro") ? msg : `No se pudo abrir el lote: ${msg}`);
    }
  };

  // Filtrado y ordenamiento de lotes (RF-10)
  const visibleLots = useMemo(() => {
    let result = [...lots];

    // Filtro por estado del lote (abierto / cerrado)
    if (filters.status !== "all") {
      result = result.filter((l) => l.status === filters.status);
    }

    // Filtro por semáforo de vencimiento
    if (filters.expiryStatus !== "all") {
      result = result.filter((l) => l.expiry_status === filters.expiryStatus);
    }

    // Filtro por texto
    const search = filters.search.toLowerCase().trim();
    if (search) {
      result = result.filter(
        (l) =>
          l.product_name.toLowerCase().includes(search) ||
          l.presentation_name.toLowerCase().includes(search) ||
          (l.supplier_name && l.supplier_name.toLowerCase().includes(search))
      );
    }

    // Ordenamiento
    result.sort((a, b) => {
      if (filters.sortBy === "effective_expiry") {
        if (a.effective_expiry_date && b.effective_expiry_date) {
          return a.effective_expiry_date.localeCompare(b.effective_expiry_date);
        }
        if (a.effective_expiry_date) return -1;
        if (b.effective_expiry_date) return 1;
        return a.received_at.localeCompare(b.received_at);
      }

      if (filters.sortBy === "received_at") {
        return b.received_at.localeCompare(a.received_at); // Más recientes primero
      }

      return a.product_name.localeCompare(b.product_name);
    });

    return result;
  }, [lots, filters]);

  // Contadores resumen para KPI cards
  const stats = useMemo(() => {
    const openLots = lots.filter((l) => l.status === "open");
    let expired = 0;
    let critical = 0;
    let warning = 0;
    let good = 0;

    for (const lot of openLots) {
      if (lot.expiry_status === "expired") expired++;
      else if (lot.expiry_status === "critical") critical++;
      else if (lot.expiry_status === "warning") warning++;
      else if (lot.expiry_status === "good") good++;
    }

    return {
      totalOpen: openLots.length,
      expired,
      critical,
      warning,
      good,
    };
  }, [lots]);

  return {
    lots: visibleLots,
    allLotsCount: lots.length,
    loading,
    error,
    filters,
    setFilters,
    stats,
    refreshLots: fetchLots,
    markLotOpened,
    hasActiveOpenBag,
  };
}
