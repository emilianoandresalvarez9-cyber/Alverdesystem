import { describe, expect, it } from "vitest";
import { getEffectiveMultiplier, suggestPresentationPrice } from "./priceSuggestion";

describe("getEffectiveMultiplier", () => {
  const categories = [
    { id: "root", parent_id: null },
    { id: "child", parent_id: "root" }
  ];

  it("prioriza producto, rubro más específico, rubro padre y valor general", () => {
    expect(getEffectiveMultiplier({ productMultiplier: 3, categoryId: "child", categories,
      categoryMultipliers: [{ category_id: "child", multiplier: 2.5 }], defaultMultiplier: 2 })).toBe(3);
    expect(getEffectiveMultiplier({ productMultiplier: null, categoryId: "child", categories,
      categoryMultipliers: [{ category_id: "child", multiplier: 2.5 }, { category_id: "root", multiplier: 2.2 }], defaultMultiplier: 2 })).toBe(2.5);
    expect(getEffectiveMultiplier({ productMultiplier: null, categoryId: "child", categories,
      categoryMultipliers: [{ category_id: "root", multiplier: 2.2 }], defaultMultiplier: 2 })).toBe(2.2);
    expect(getEffectiveMultiplier({ productMultiplier: null, categoryId: null, categories,
      categoryMultipliers: [], defaultMultiplier: 2 })).toBe(2);
  });
});

describe("suggestPresentationPrice", () => {
  it("normaliza costo del envase, multiplica por la presentación y redondea hacia arriba a $100", () => {
    expect(suggestPresentationPrice({ packageCost: 40_000, packageQuantity: 25_000,
      presentationQuantity: 150, multiplier: 2 })).toEqual({ salePrice: 500, displayPrice: 500 });
  });

  it("sugiere precio por kilo y devuelve el precio interno por gramo para balanza", () => {
    expect(suggestPresentationPrice({ packageCost: 40_000, packageQuantity: 25_000,
      presentationQuantity: 1, multiplier: 2, soldByWeight: true })).toEqual({ salePrice: 3.2, displayPrice: 3200 });
  });

  it("rechaza cantidades, multiplicadores o costos inválidos", () => {
    expect(suggestPresentationPrice({ packageCost: 100, packageQuantity: 0,
      presentationQuantity: 1, multiplier: 2 })).toBeNull();
    expect(suggestPresentationPrice({ packageCost: -1, packageQuantity: 1,
      presentationQuantity: 1, multiplier: 2 })).toBeNull();
  });
});
