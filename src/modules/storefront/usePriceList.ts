import { useCallback, useEffect, useRef, useState } from "react";
import { hasSupabaseConfig } from "../../shared/config/env";
import { fetchPublicBranches, fetchPublicPriceList } from "./api";
import { changedPresentations, type PublicBranch, type PublicProduct } from "./priceList";

/** Cada cuánto se vuelve a pedir la lista mientras la página está a la vista. */
export const REFRESH_MS = 30_000;

export type PriceListState = {
  products: PublicProduct[];
  branches: PublicBranch[];
  branchId: string | null;
  setBranchId: (id: string) => void;
  /** Primera carga: todavía no hay nada para mostrar. */
  isLoading: boolean;
  /** No se pudo traer la lista. Si ya había una, se sigue mostrando la última. */
  failed: boolean;
  /** Momento (ms) de la última lista que llegó bien; null si nunca llegó. */
  updatedAt: number | null;
  /** Reloj de la página, para decir hace cuánto se actualizó. */
  now: number;
  /** Presentaciones que cambiaron de precio o disponibilidad en la última actualización. */
  changed: ReadonlySet<string>;
};

/**
 * Lista de precios pública «en vivo»: se pide al entrar, cada 30 segundos mientras la pestaña
 * está visible, y al volver a la pestaña o recuperar la conexión. Un precio cambiado en
 * Administración o una venta en la caja se ven acá en el siguiente pedido.
 */
export function usePriceList(): PriceListState {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [changed, setChanged] = useState<ReadonlySet<string>>(() => new Set());
  const request = useRef(0);
  /** Última lista mostrada y de qué sucursal, para detectar qué cambió. */
  const shown = useRef<{ branch: string | null; list: PublicProduct[] } | null>(null);

  const load = useCallback(async (branch: string | null) => {
    if (!hasSupabaseConfig) {
      setFailed(true);
      setIsLoading(false);
      return;
    }
    const mine = ++request.current;
    try {
      const list = await fetchPublicPriceList(branch);
      if (mine !== request.current) return; // llegó tarde: ya se pidió otra sucursal
      const previous = shown.current && shown.current.branch === branch ? shown.current.list : null;
      setChanged(changedPresentations(previous, list));
      shown.current = { branch, list };
      setProducts(list);
      setUpdatedAt(Date.now());
      setFailed(false);
    } catch {
      if (mine === request.current) setFailed(true);
    } finally {
      if (mine === request.current) {
        setIsLoading(false);
        setNow(Date.now());
      }
    }
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    void fetchPublicBranches().then(setBranches).catch(() => { /* la lista de precios igual se muestra */ });
  }, []);

  useEffect(() => {
    void load(branchId);
    const refresh = () => { if (document.visibilityState === "visible") void load(branchId); };
    const timer = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [branchId, load]);

  return { products, branches, branchId, setBranchId, isLoading, failed, updatedAt, now, changed };
}
