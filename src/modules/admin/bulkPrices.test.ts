import { describe, expect, it } from "vitest";
import { parsePercent, retagMatrix, summarizePreview, type PriceChange, type RetagRow } from "./bulkPrices";

const change = (over: Partial<PriceChange>): PriceChange => ({
  presentation_id: "p1", product_id: "x1", product_name: "Almendras", presentation_name: "Granel",
  old_price: 14800, new_price: 16300, ...over
});

describe("RF-28: porcentaje de la actualización masiva", () => {
  it("acepta enteros, negativos y coma decimal", () => {
    expect(parsePercent("10")).toEqual({ ok: true, percent: 10 });
    expect(parsePercent("-5")).toEqual({ ok: true, percent: -5 });
    expect(parsePercent(" 12,5 ")).toEqual({ ok: true, percent: 12.5 });
  });

  it("rechaza cero, -100 o menos, y texto", () => {
    expect(parsePercent("0").ok).toBe(false);
    expect(parsePercent("-100").ok).toBe(false);
    expect(parsePercent("-250").ok).toBe(false);
    expect(parsePercent("diez").ok).toBe(false);
    expect(parsePercent("").ok).toBe(false);
  });
});

describe("RF-28: resumen de la vista previa antes de confirmar", () => {
  it("cuenta subas, bajas y totales", () => {
    const summary = summarizePreview([
      change({}),
      change({ presentation_id: "p2", old_price: 4100, new_price: 3900 }),
      change({ presentation_id: "p3", old_price: 2900, new_price: 3200 })
    ]);
    expect(summary).toEqual({ count: 3, increases: 2, decreases: 1, oldTotal: 21800, newTotal: 23400 });
  });

  it("con lista vacía todo queda en cero", () => {
    expect(summarizePreview([])).toEqual({ count: 0, increases: 0, decreases: 0, oldTotal: 0, newTotal: 0 });
  });
});

describe("RF-30: lista de reetiquetado", () => {
  const row = (over: Partial<RetagRow>): RetagRow => ({
    ...change({}), internal_barcode: "2000000000017", changed_at: "2026-10-09T20:00:00Z", ...over
  });

  it("solo incluye lo que cambió, con precio anterior y nuevo", () => {
    const matrix = retagMatrix([
      row({}),
      row({ presentation_id: "p2", presentation_name: "Paquete", internal_barcode: null, old_price: 4100, new_price: 4100 })
    ]);
    expect(matrix).toEqual([["Almendras", "Granel", "2000000000017", 14800, 16300]]);
  });
});
