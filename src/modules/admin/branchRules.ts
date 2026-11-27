// Sucursales y cajas: reglas puras de la pantalla (RF-53, RF-55, RF-66).

export type BranchLike = { id: string; name: string; created_at: string; archived_at: string | null };

/**
 * Sucursal principal: la más antigua que no está archivada. Es la misma regla que
 * `default_branch_id()` en la base, que es donde trabaja quien no tiene sucursal asignada.
 */
export function mainBranch<T extends BranchLike>(branches: readonly T[]): T | undefined {
  return branches
    .filter((b) => !b.archived_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))[0];
}

type ActionError = { message: string; code?: string | null };

/** Mensaje para la persona: el nombre repetido llega de la base como 23505, en inglés. */
export function describeBranchError(error: ActionError): string {
  if (error.code === "23505") return "Ya hay una con ese nombre. Elegí otro nombre.";
  return error.message;
}

/**
 * Ejecuta una acción y vuelve a cargar la lista. Devuelve el mensaje de error DESPUÉS de recargar:
 * la recarga limpia el error anterior, y si el de la acción se mostraba antes, se borraba solo
 * (una «Caja 1» repetida no avisaba nada).
 */
export async function runAndReload(
  action: () => PromiseLike<{ error: ActionError | null }>,
  reload: () => Promise<void>
): Promise<string | null> {
  const { error } = await action();
  await reload();
  return error ? describeBranchError(error) : null;
}
