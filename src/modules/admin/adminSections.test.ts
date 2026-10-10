import { describe, expect, it } from "vitest";
import { ADMIN_GROUPS, ADMIN_SECTIONS, sectionFromHash, sectionLabel } from "./adminSections";

describe("Administración en cinco grupos (sistema de diseño)", () => {
  it("las 13 pestañas de antes más Márgenes, cada una una sola vez", () => {
    const ids = ADMIN_SECTIONS.map((s) => s.id);
    expect(ids).toHaveLength(14);
    expect(new Set(ids).size).toBe(14);
    expect(ADMIN_GROUPS.map((g) => g.label)).toEqual(["Ventas", "Mercadería", "Productos y precios", "Negocio", "Sistema"]);
  });

  it("RF-26: Márgenes tiene su lugar en Ventas y se puede abrir por enlace", () => {
    expect(ADMIN_GROUPS[0]!.sections.map((s) => s.id)).toEqual(["reportes", "margenes"]);
    expect(sectionFromHash("#margenes")).toBe("margenes");
    expect(sectionLabel("margenes")).toBe("Márgenes");
  });

  it("un hash desconocido abre Reportes", () => {
    expect(sectionFromHash("")).toBe("reportes");
    expect(sectionFromHash("#nada")).toBe("reportes");
  });

  it("sin emojis ni códigos internos en los nombres", () => {
    for (const s of ADMIN_SECTIONS) {
      expect(s.label, s.id).not.toMatch(/\p{Extended_Pictographic}|RF-|FEFO|ABM|Fase/u);
    }
  });
});
