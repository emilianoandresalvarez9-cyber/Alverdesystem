/**
 * RF-59: qué puede hacer administración con el acceso de cada persona. La base aplica las mismas
 * reglas (guard_profile_changes): nadie se da de baja a sí mismo y siempre queda al menos una
 * persona de administración activa. Desde #107, dar de baja corta el acceso de verdad.
 */
export type StaffPerson = { id: string; role: "administrator" | "employee"; active: boolean };

export type StaffAccess =
  | { kind: "activate" }
  | { kind: "deactivate" }
  | { kind: "locked"; reason: string };

export function staffAccess(person: StaffPerson, meId: string, people: readonly StaffPerson[]): StaffAccess {
  if (!person.active) return { kind: "activate" };
  if (person.id === meId) return { kind: "locked", reason: "Es tu usuario: la baja la hace otra persona de administración." };
  const otherActiveAdmins = people.filter((p) => p.role === "administrator" && p.active && p.id !== person.id).length;
  if (person.role === "administrator" && otherActiveAdmins === 0) {
    return { kind: "locked", reason: "Es la única persona de administración activa." };
  }
  return { kind: "deactivate" };
}
