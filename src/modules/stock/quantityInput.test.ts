import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseStockQuantity } from "./quantityInput";

describe("parseStockQuantity (E-01, E-02)", () => {
  it("acepta enteros y hasta tres decimales, con punto o coma", () => {
    expect(parseStockQuantity("3")).toEqual({ ok: true, quantity: 3 });
    expect(parseStockQuantity(" 2,5 ")).toEqual({ ok: true, quantity: 2.5 });
    expect(parseStockQuantity("1.005")).toEqual({ ok: true, quantity: 1.005 });
    expect(parseStockQuantity("0.001")).toEqual({ ok: true, quantity: 0.001 });
  });

  it("rechaza más de tres decimales, que la base no guarda", () => {
    expect(parseStockQuantity("0.0005")).toEqual({ ok: false, reason: "Hasta tres decimales." });
    expect(parseStockQuantity("12.3456")).toEqual({ ok: false, reason: "Hasta tres decimales." });
    expect(parseStockQuantity("1e-4")).toEqual({ ok: false, reason: "Hasta tres decimales." });
  });

  it("rechaza vacío, texto, cero y negativos con el mensaje de la pantalla", () => {
    for (const raw of ["", "  ", "abc", "0", "-2", "1.2.3"]) {
      expect(parseStockQuantity(raw), raw).toEqual({ ok: false, reason: "Ingresá una cantidad mayor a 0." });
    }
    expect(parseStockQuantity("", "Indicá cuánto traspasar.")).toEqual({ ok: false, reason: "Indicá cuánto traspasar." });
  });

  it("el ajuste de stock valida con esta función antes de encolar (E-02)", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/stock/StockAdjustmentModal.tsx"), "utf8");
    expect(source).toContain("const parsed = parseStockQuantity(quantity);");
    expect(source).not.toContain("parseFloat(quantity)");
  });
});
