import { describe, expect, it } from "vitest";
import { presentationPriceLabel, pricePerKiloFromGram, validatePricePerKilo } from "./scalePricing";

describe("precios de Balanza (ADR-001)", () => {
  it("acepta precios por kilo múltiplos de $10, como la base", () => {
    expect(validatePricePerKilo(3000)).toBeNull();
    expect(validatePricePerKilo(3150)).toBeNull();
    expect(validatePricePerKilo(3155)).toMatch(/múltiplo de \$10/);
    expect(validatePricePerKilo(0)).toMatch(/precio por kilo/);
  });

  it("muestra por kilo lo que se guarda por gramo", () => {
    expect(pricePerKiloFromGram(3)).toBe(3000);
    expect(pricePerKiloFromGram(3.15)).toBe(3150);
    const fmt = (v: number) => `$${v}`;
    expect(presentationPriceLabel({ sale_price: 3, sold_by_weight: true }, fmt)).toBe("$3000/kg");
    expect(presentationPriceLabel({ sale_price: 900, sold_by_weight: false }, fmt)).toBe("$900");
  });
});
