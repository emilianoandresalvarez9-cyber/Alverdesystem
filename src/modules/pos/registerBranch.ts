import type { RegisterOption } from "./shift";

/**
 * RF-66: el empleado abre turno sólo en cajas de su sucursal (la base lo exige con
 * guard_cash_shift_branch). Un equipo puede haber quedado asignado a una caja de otra sucursal
 * (lo usaba alguien de allá): la pantalla avisa antes de abrir, también sin conexión, en vez
 * de dejar abrir un turno que la base va a rechazar. null = se puede abrir.
 */
export function registerBranchWarning({ isAdmin, workingBranchId, workingBranchLabel, register }: {
  isAdmin: boolean;
  workingBranchId: string | null;
  workingBranchLabel: string;
  register: RegisterOption;
}): string | null {
  if (isAdmin || !workingBranchId || !register.branchId) return null;
  if (register.branchId === workingBranchId) return null;
  const other = register.branchName || "otra sucursal";
  return `${register.name} es de ${other} y vos trabajás en ${workingBranchLabel}. Elegí una caja de tu sucursal con «Este equipo es otra caja», o pedile a administración que te asigne a ${other}.`;
}
