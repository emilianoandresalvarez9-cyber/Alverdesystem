import { describe, expect, it } from "vitest";
import { branchForWrite, filterBranchId, resolveSelection, selectionLabel } from "./branch";

const branches = [{ id: "centro", name: "Centro" }, { id: "norte", name: "Norte" }];

describe("RF-66: sucursal de trabajo", () => {
  it("el empleado trabaja en la suya aunque el equipo tenga guardada otra o 'Todas'", () => {
    expect(resolveSelection({ isAdmin: false, ownBranchId: "norte", stored: "centro", branches })).toEqual({ kind: "branch", id: "norte" });
    expect(resolveSelection({ isAdmin: false, ownBranchId: "norte", stored: "all", branches })).toEqual({ kind: "branch", id: "norte" });
  });

  it("la administradora conserva lo elegido en el equipo, incluido 'Todas'", () => {
    expect(resolveSelection({ isAdmin: true, ownBranchId: "centro", stored: "norte", branches })).toEqual({ kind: "branch", id: "norte" });
    expect(resolveSelection({ isAdmin: true, ownBranchId: "centro", stored: "all", branches })).toEqual({ kind: "all" });
  });

  it("si lo guardado ya no existe (sucursal archivada), vuelve a la propia", () => {
    expect(resolveSelection({ isAdmin: true, ownBranchId: "centro", stored: "vieja", branches })).toEqual({ kind: "branch", id: "centro" });
  });

  it("con una sola sucursal no hay 'Todas'", () => {
    expect(resolveSelection({ isAdmin: true, ownBranchId: "centro", stored: "all", branches: [branches[0]!] })).toEqual({ kind: "branch", id: "centro" });
  });

  it("filtros y escritura", () => {
    expect(filterBranchId({ kind: "all" })).toBeNull();
    expect(filterBranchId({ kind: "branch", id: "norte" })).toBe("norte");
    expect(branchForWrite({ kind: "branch", id: "norte" }, false)).toBeUndefined();
    expect(branchForWrite({ kind: "branch", id: "norte" }, true)).toBe("norte");
    expect(branchForWrite({ kind: "all" }, true)).toBeNull();
  });

  it("etiqueta legible", () => {
    expect(selectionLabel({ kind: "all" }, branches)).toBe("Todas las sucursales");
    expect(selectionLabel({ kind: "branch", id: "norte" }, branches)).toBe("Norte");
  });
});
