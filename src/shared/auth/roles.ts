export type AppRole = "administrator" | "employee";

export type Profile = { id: string; role: AppRole; active: boolean };

/** Página de inicio de cada rol después de ingresar. */
export function homeFor(role: AppRole): string {
  return role === "administrator" ? "/admin.html" : "/catalog.html";
}

/** Un administrador accede a todo; un empleado solo a páginas sin rol requerido. */
export function canAccess(role: AppRole, required?: AppRole): boolean {
  if (!required) return true;
  return role === required || role === "administrator";
}

/** Normaliza lo que venga de la base o del caché local; ante duda, el rol de menor privilegio. */
export function parseRole(value: unknown): AppRole {
  return value === "administrator" ? "administrator" : "employee";
}
