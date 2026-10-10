import { describe, expect, it } from "vitest";
import { registerBranchWarning } from "./registerBranch";

const norte = { id: "c9", name: "Caja Norte", branchName: "Norte", branchId: "norte" };

describe("RF-66: el empleado abre turno sólo en cajas de su sucursal", () => {
  it("avisa si el equipo quedó asignado a una caja de otra sucursal, y dice qué hacer", () => {
    const warning = registerBranchWarning({ isAdmin: false, workingBranchId: "centro", workingBranchLabel: "Centro", register: norte });
    expect(warning).toContain("Caja Norte es de Norte y vos trabajás en Centro");
    expect(warning).toContain("Este equipo es otra caja");
    expect(warning).toContain("te asigne a Norte");
  });

  it("no avisa en una caja de su sucursal", () => {
    expect(registerBranchWarning({ isAdmin: false, workingBranchId: "norte", workingBranchLabel: "Norte", register: norte })).toBeNull();
  });

  it("administración abre turno en cualquier caja", () => {
    expect(registerBranchWarning({ isAdmin: true, workingBranchId: "centro", workingBranchLabel: "Centro", register: norte })).toBeNull();
  });

  it("si no se sabe la sucursal (equipo viejo o sin copia), no bloquea: decide la base", () => {
    expect(registerBranchWarning({ isAdmin: false, workingBranchId: null, workingBranchLabel: "Sin sucursal", register: norte })).toBeNull();
    const { branchId: _omit, ...withoutBranch } = norte;
    expect(registerBranchWarning({ isAdmin: false, workingBranchId: "centro", workingBranchLabel: "Centro", register: withoutBranch })).toBeNull();
  });
});
