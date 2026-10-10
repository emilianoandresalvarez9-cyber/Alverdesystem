import { describe, expect, it } from "vitest";
import { staffAccess, type StaffPerson } from "./staffAccess";

const luciana: StaffPerson = { id: "a1", role: "administrator", active: true };
const sofia: StaffPerson = { id: "a2", role: "administrator", active: true };
const tomas: StaffPerson = { id: "e1", role: "employee", active: true };
const exEmpleado: StaffPerson = { id: "e9", role: "employee", active: false };

describe("RF-59: activar y dar de baja personal", () => {
  it("a un empleado activo se lo puede dar de baja", () => {
    expect(staffAccess(tomas, luciana.id, [luciana, tomas])).toEqual({ kind: "deactivate" });
  });

  it("a alguien dado de baja se lo puede volver a activar", () => {
    expect(staffAccess(exEmpleado, luciana.id, [luciana, exEmpleado])).toEqual({ kind: "activate" });
  });

  it("nadie se da de baja a sí mismo", () => {
    const access = staffAccess(luciana, luciana.id, [luciana, sofia, tomas]);
    expect(access.kind).toBe("locked");
    expect(access.kind === "locked" && access.reason).toMatch(/Es tu usuario/);
  });

  it("a otra administradora se la puede dar de baja si queda alguien más en administración", () => {
    expect(staffAccess(sofia, luciana.id, [luciana, sofia])).toEqual({ kind: "deactivate" });
  });

  it("no se da de baja a la única administradora activa", () => {
    const sinLuciana = { ...luciana, active: false };
    const access = staffAccess(sofia, "otra-cuenta", [sinLuciana, sofia, tomas]);
    expect(access).toEqual({ kind: "locked", reason: "Es la única persona de administración activa." });
  });
});
