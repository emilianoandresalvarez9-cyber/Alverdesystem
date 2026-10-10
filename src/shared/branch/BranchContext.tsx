import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabase } from "../supabase/client";
import {
  BRANCH_CACHE_KEY, BRANCH_STORAGE_KEY, branchForWrite, filterBranchId, resolveSelection, selectionLabel, serializeSelection,
  type BranchOption, type BranchSelection
} from "./branch";

export interface BranchContextValue {
  branches: BranchOption[];
  selection: BranchSelection | null;
  /** Solo la administradora elige (RF-66). */
  canChoose: boolean;
  isAdmin: boolean;
  label: string;
  /** null = todas las sucursales (solo administradora). */
  filterId: string | null;
  /** La sucursal concreta en la que se está (empleado: la suya); null si la administradora eligió "Todas". */
  workingBranchId: string | null;
  /** Para operaciones que crean stock: undefined (empleado, decide el servidor), id, o null si falta elegir. */
  writeId: string | null | undefined;
  setSelection: (selection: BranchSelection) => void;
}

const FALLBACK: BranchContextValue = {
  branches: [], selection: null, canChoose: false, isAdmin: false, label: "Sin sucursal",
  filterId: null, workingBranchId: null, writeId: undefined, setSelection: () => {}
};

const BranchContext = createContext<BranchContextValue>(FALLBACK);

export function useBranch(): BranchContextValue {
  return useContext(BranchContext);
}

type Cache = { branches: BranchOption[]; ownBranchId: string | null };

function readStorage(key: string): string | null {
  try { return typeof localStorage === "undefined" ? null : localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* sin almacenamiento: vale solo esta sesión */ }
}
function readCache(): Cache | null {
  const raw = readStorage(BRANCH_CACHE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Cache; } catch { return null; }
}

/** Carga las sucursales y la propia; sin conexión usa la última copia guardada (RF-66). */
export function BranchProvider({ isAdmin, children }: PropsWithChildren<{ isAdmin: boolean }>) {
  const [data, setData] = useState<Cache | null>(() => readCache());
  const [stored, setStored] = useState<string | null>(() => readStorage(BRANCH_STORAGE_KEY));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const sb = getSupabase();
        const [list, own] = await Promise.all([
          sb.from("branches").select("id, name").is("archived_at", null).order("created_at").order("id"),
          sb.rpc("current_branch_id")
        ]);
        if (list.error || own.error) return;
        const next: Cache = { branches: list.data ?? [], ownBranchId: own.data ?? null };
        writeStorage(BRANCH_CACHE_KEY, JSON.stringify(next));
        if (!cancelled) setData(next);
      } catch {
        // Sin conexión o sin configuración: queda la copia guardada.
      }
    }
    void load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === BRANCH_STORAGE_KEY) setStored(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => { cancelled = true; window.removeEventListener("storage", onStorage); };
  }, []);

  const branches = data?.branches ?? [];
  const selection = useMemo(
    () => resolveSelection({ isAdmin, ownBranchId: data?.ownBranchId ?? null, stored, branches }),
    [isAdmin, data, stored, branches]
  );

  const setSelection = useCallback((next: BranchSelection) => {
    if (!isAdmin) return;
    const value = serializeSelection(next);
    writeStorage(BRANCH_STORAGE_KEY, value);
    setStored(value);
  }, [isAdmin]);

  const value = useMemo<BranchContextValue>(() => ({
    branches,
    selection,
    canChoose: isAdmin && branches.length > 1,
    isAdmin,
    label: selectionLabel(selection, branches),
    filterId: isAdmin ? filterBranchId(selection) : null,
    workingBranchId: filterBranchId(selection),
    writeId: branchForWrite(selection, isAdmin),
    setSelection
  }), [branches, selection, isAdmin, setSelection]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}
