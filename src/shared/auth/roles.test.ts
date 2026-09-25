import { describe, expect, it } from "vitest";
import { canAccess, homeFor, parseRole } from "./roles";

describe("roles", () => {
  it("envía a cada rol a su inicio", () => {
    expect(homeFor("administrator")).toBe("/admin.html");
    expect(homeFor("employee")).toBe("/pos.html");
  });

  it("un empleado no accede a páginas de administrador", () => {
    expect(canAccess("employee", "administrator")).toBe(false);
    expect(canAccess("administrator", "administrator")).toBe(true);
    expect(canAccess("employee")).toBe(true);
  });

  it("ante un valor desconocido asume el rol de menor privilegio", () => {
    expect(parseRole("administrator")).toBe("administrator");
    expect(parseRole("admin")).toBe("employee");
    expect(parseRole(undefined)).toBe("employee");
  });
});
