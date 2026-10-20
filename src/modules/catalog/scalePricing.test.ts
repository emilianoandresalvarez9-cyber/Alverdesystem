import { describe, expect, it } from "vitest";
import { parseEditedPrice, presentationPriceLabel, priceEditStart, pricePerKiloFromGram, validatePricePerKilo } from "./scalePricing";

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

describe("Cambiar precio desde la ficha del producto", () => {
  const granel = { sale_price: 3.15, sold_by_weight: true };
  const frasco = { sale_price: 3000, sold_by_weight: false };

  it("en Balanza el diálogo arranca con el precio por kilo que se ve en la tabla", () => {
    expect(priceEditStart(granel)).toBe("3150");
    expect(priceEditStart(frasco)).toBe("3000");
  });

  it("en Balanza guarda por gramo lo que se cargó por kilo, no 1000 veces más", () => {
    expect(parseEditedPrice("3500", true)).toEqual({ ok: true, salePrice: 3.5 });
    expect(parseEditedPrice("3150", true)).toEqual({ ok: true, salePrice: 3.15 });
    expect(pricePerKiloFromGram(3.5)).toBe(3500);
  });

  it("en Balanza exige múltiplos de $10 por kilo, como la base", () => {
    expect(parseEditedPrice("3155", true)).toEqual({
      ok: false, error: "El precio por kilo tiene que ser múltiplo de $10 (por ejemplo, $3.150 y no $3.155)."
    });
    expect(parseEditedPrice("", true)).toMatchObject({ ok: false });
  });

  it("fuera de Balanza guarda el precio de la presentación tal cual", () => {
    expect(parseEditedPrice("3500", false)).toEqual({ ok: true, salePrice: 3500 });
    expect(parseEditedPrice("0", false)).toEqual({ ok: true, salePrice: 0 });
    expect(parseEditedPrice("-1", false)).toEqual({ ok: false, error: "Ingresá un precio válido mayor o igual a 0." });
    expect(parseEditedPrice(" ", false)).toMatchObject({ ok: false });
  });
});
