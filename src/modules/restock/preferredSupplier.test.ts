import { describe, expect, it } from "vitest";
import { preferredSupplier } from "./preferredSupplier";

describe("proveedor principal de reposición (RF-24, RF-50)", () => {
  it("prioriza el vínculo marcado is_primary aunque aparezca después", () => {
    const links = [
      { is_primary: false, supplier: { id: "s1", name: "Secundario", contact: null } },
      { is_primary: true, supplier: { id: "s2", name: "Principal", contact: "555" } }
    ];
    expect(preferredSupplier(links)?.id).toBe("s2");
  });

  it("usa el primer proveedor si todavía no hay uno principal y acepta relación vacía", () => {
    expect(preferredSupplier([
      { is_primary: false, supplier: { id: "s1", name: "Proveedor", contact: null } }
    ])?.id).toBe("s1");
    expect(preferredSupplier([])).toBeNull();
  });
});
