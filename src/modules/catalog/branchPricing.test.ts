import { describe, expect, it } from "vitest";
import { effectivePrice, hasOwnPrice, parseBranchPrices } from "./branchPricing";

const bolsa = { sale_price: 4000, branch_prices: { norte: 4500 } };

describe("RF-69: precio por sucursal", () => {
  it("la sucursal con precio propio lo usa; la otra usa el base", () => {
    expect(effectivePrice(bolsa, "norte")).toBe(4500);
    expect(effectivePrice(bolsa, "centro")).toBe(4000);
  });

  it("sin sucursal (Todas) o sin datos de sucursales (copia vieja sin conexión) rige el base", () => {
    expect(effectivePrice(bolsa, null)).toBe(4000);
    expect(effectivePrice({ sale_price: 4000 }, "norte")).toBe(4000);
  });

  it("un precio propio de cero cuenta (no es 'sin precio')", () => {
    expect(effectivePrice({ sale_price: 4000, branch_prices: { norte: 0 } }, "norte")).toBe(0);
    expect(hasOwnPrice({ sale_price: 4000, branch_prices: { norte: 0 } }, "norte")).toBe(true);
  });

  it("lee el jsonb de la vista aunque los números vengan como texto", () => {
    expect(parseBranchPrices({ norte: "4500.00", mal: "x" })).toEqual({ norte: 4500 });
    expect(parseBranchPrices(null)).toEqual({});
  });
});
