/**
 * RF-66: en qué sucursal se está trabajando. Lógica pura (sin React ni Supabase).
 *
 * - El Empleado trabaja siempre en su sucursal (la asignada o la principal): no elige.
 * - El Administrador elige cualquier sucursal activa o "Todas" (solo para consultar).
 * - La elección se guarda por equipo en localStorage, así vale también sin conexión.
 */

export const BRANCH_STORAGE_KEY = "alverde-sucursal";
export const BRANCH_CACHE_KEY = "alverde-sucursales-cache";
export const ALL_BRANCHES = "all";

export interface BranchOption {
  id: string;
  name: string;
}

export type BranchSelection = { kind: "branch"; id: string } | { kind: "all" };

export interface ResolveInput {
  isAdmin: boolean;
  /** Sucursal propia del usuario según el servidor (current_branch_id). */
  ownBranchId: string | null;
  /** Lo guardado en este equipo: un id, "all" o nada. */
  stored: string | null;
  branches: BranchOption[];
}

/** Qué sucursal queda seleccionada. Nunca deja al empleado fuera de la suya. */
export function resolveSelection({ isAdmin, ownBranchId, stored, branches }: ResolveInput): BranchSelection | null {
  const exists = (id: string | null) => !!id && branches.some((b) => b.id === id);
  if (!isAdmin) {
    return ownBranchId ? { kind: "branch", id: ownBranchId } : null;
  }
  if (stored === ALL_BRANCHES && branches.length > 1) return { kind: "all" };
  if (exists(stored)) return { kind: "branch", id: stored as string };
  if (exists(ownBranchId)) return { kind: "branch", id: ownBranchId as string };
  const first = branches[0];
  return first ? { kind: "branch", id: first.id } : null;
}

/** Id para filtrar listados; null = todas las sucursales. */
export function filterBranchId(selection: BranchSelection | null): string | null {
  return selection?.kind === "branch" ? selection.id : null;
}

/**
 * Sucursal para una operación que crea stock (ingreso, faltante).
 * - Empleado: undefined → el servidor usa la suya.
 * - Administrador con una sucursal elegida: ese id.
 * - Administrador en "Todas": null → la pantalla tiene que pedir que elija una.
 */
export function branchForWrite(selection: BranchSelection | null, isAdmin: boolean): string | null | undefined {
  if (!isAdmin) return undefined;
  return selection?.kind === "branch" ? selection.id : null;
}

export function serializeSelection(selection: BranchSelection): string {
  return selection.kind === "all" ? ALL_BRANCHES : selection.id;
}

export function selectionLabel(selection: BranchSelection | null, branches: BranchOption[]): string {
  if (!selection) return "Sin sucursal";
  if (selection.kind === "all") return "Todas las sucursales";
  return branches.find((b) => b.id === selection.id)?.name ?? "Sucursal";
}
