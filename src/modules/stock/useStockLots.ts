import { useEffect, useState, useCallback, useMemo } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { calculateEffectiveExpiry, getDaysUntilExpiry, evaluateExpiryStatus } from "./expiry";
import type { StockLot, StockLotFilters, LotExpiryStatus } from "./types";

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
        .from("stock_lots")
        .select(`
          id, presentation_id, supplier_id, initial_quantity, current_quantity,
          purchase_cost, received_at, manufacturer_expiry_date, opened_at, portioned_at,
          status, created_at,
          presentation:product_presentations(
            id, name, base_quantity, internal_barcode,
            product:products(id, name, base_unit, open_shelf_life_days, active)
          ),
          supplier:suppliers(id, name)
        `)
        .order("created_at", { ascending: false });

      if (err) throw err;

      const normalized: StockLot[] = (data ?? []).map((row: any) => {
        const pres = row.presentation;
        const prod = pres?.product;
        const mfgExpiry = row.manufacturer_expiry_date;
        const openedAt = row.opened_at;
        const shelfLife = prod?.open_shelf_life_days ?? null;

        const effectiveExpiry = calculateEffectiveExpiry(mfgExpiry, openedAt, shelfLife);
        const days = getDaysUntilExpiry(effectiveExpiry);
        const status = evaluateExpiryStatus(days);

        return {
          id: row.id,
          presentation_id: row.presentation_id,
          supplier_id: row.supplier_id,
          initial_quantity: row.initial_quantity,
          current_quantity: row.current_quantity,
          purchase_cost: row.purchase_cost,
          received_at: row.received_at,
          manufacturer_expiry_date: mfgExpiry,
          opened_at: openedAt,
          portioned_at: row.portioned_at,
          status: row.status,
          created_at: row.created_at,

          product_id: prod?.id ?? "",
          product_name: prod?.name ?? "Producto Desconocido",
          presentation_name: pres?.name ?? "Presentación Única",
          base_unit: prod?.base_unit ?? "unit",
          base_quantity: pres?.base_quantity ?? 1,
          open_shelf_life_days: shelfLife,
          supplier_name: row.supplier?.name ?? null,

          effective_expiry_date: effectiveExpiry,
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
      (l) => l.product_id === productId && l.status === "open" && l.opened_at !== null && l.current_quantity > 0
    );
  }, [lots]);

  // RF-08 / RF-11: Abrir lote (registra opened_at)
  const markLotOpened = async (lotId: string) => {
    try {
      const supabase = getSupabase();
      const now = new Date().toISOString();
      const { error: err } = await supabase
        .from("stock_lots")
        .update({ opened_at: now })
        .eq("id", lotId);

      if (err) throw err;
      await fetchLots();
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("Regla de oro")) {
        console.log(msg); // Muestra el error estructurado de la base de datos
      } else {
        console.log(`Error al abrir lote: ${msg}`);
      }
    }
  };

  // RF-56: Archivar producto sin borrar ventas históricas
  const archiveProduct = async (productId: string) => {
    try {
      const supabase = getSupabase();
      const { error: err } = await supabase
        .from("products")
        .update({ active: false })
        .eq("id", productId);

      if (err) throw err;
      await fetchLots();
    } catch (e) {
      console.log(e instanceof Error ? `Error al archivar: ${e.message}` : "Error al archivar producto");
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
    archiveProduct,
  };
}
