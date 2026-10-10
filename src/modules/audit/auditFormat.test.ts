import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, entityLabel, fieldLabel, formatValue, toSearchArgs } from "./auditFormat";

describe("RF-60: historial legible", () => {
  it("traduce entidad y campo", () => {
    expect(entityLabel("product_presentations")).toBe("Presentación");
    expect(fieldLabel("sale_price")).toBe("Precio de venta");
    expect(fieldLabel("campo_raro")).toBe("campo_raro");
  });

  it("muestra el precio como dinero aunque el trigger lo guarde como texto", () => {
    expect(formatValue("sale_price", "9500.00")).toBe(formatValue("sale_price", 9500));
    expect(formatValue("sale_price", "9500.00")).toMatch(/9\.500/);
  });

  it("una corrección de turno de caja se lee como dinero y con fecha corta (RF-32)", () => {
    expect(entityLabel("cash_shifts")).toBe("Turno de caja");
    expect(fieldLabel("initial_balance")).toBe("Monto inicial");
    expect(fieldLabel("final_balance")).toBe("Efectivo esperado");
    expect(formatValue("initial_balance", "10000.00")).toBe(formatValue("sale_price", 10000));
    expect(formatValue("closed_at", new Date(2026, 9, 10, 12, 5).toISOString())).toBe("10/10 12:05");
  });

  it("booleanos y vacíos", () => {
    expect(formatValue("active", true)).toBe("Sí");
    expect(formatValue("active", false)).toBe("No");
    expect(formatValue("name", null)).toBe("—");
    expect(formatValue("name", "Nueces")).toBe("Nueces");
  });
});

describe("RF-60: filtros → argumentos de búsqueda", () => {
  it("sin filtros solo manda el límite", () => {
    expect(toSearchArgs(EMPTY_FILTERS)).toEqual({ p_limit: 200 });
  });

  it("manda texto recortado, entidad y persona", () => {
    expect(toSearchArgs({ ...EMPTY_FILTERS, text: "  nueces ", entity: "products", userId: "u1" }))
      .toEqual({ p_limit: 200, p_text: "nueces", p_entity: "products", p_user_id: "u1" });
  });

  it("la fecha 'hasta' es inclusiva: el rango termina al día siguiente a las 00:00", () => {
    const args = toSearchArgs({ ...EMPTY_FILTERS, from: "2026-10-01", to: "2026-10-09" });
    expect(new Date(args.p_from!).getTime()).toBe(new Date("2026-10-01T00:00:00").getTime());
    expect(new Date(args.p_to!).getTime()).toBe(new Date("2026-10-10T00:00:00").getTime());
  });
});
