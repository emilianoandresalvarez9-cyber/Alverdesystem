import { describe, expect, it } from "vitest";
import { lineSubtotal, roundQuantity, sumMoney } from "./money";

describe("money: coincide con round(qty * price, 2) de Postgres", () => {
  it("350 g de granel por kg a $3000 cuestan $1050", () => {
    expect(lineSubtotal(0.35, 3000)).toBe(1050);
  });

  it("no arrastra el error de coma flotante (Postgres: round(1.005, 2) = 1.01)", () => {
    const naive = (qty: number, price: number) => Math.round(qty * price * 100) / 100;
    expect(naive(1.005, 1)).toBe(1); // el cálculo ingenuo cobra un centavo menos que el servidor
    expect(lineSubtotal(1.005, 1)).toBe(1.01);
    expect(lineSubtotal(0.145, 1)).toBe(0.15);
  });

  it("redondea mitad hacia arriba como numeric", () => {
    expect(lineSubtotal(0.125, 0.1)).toBe(0.01); // 0.0125 → 0.01
    expect(lineSubtotal(0.005, 1)).toBe(0.01); // 0.005 → 0.01
    expect(lineSubtotal(3, 1500)).toBe(4500);
  });

  it("las cantidades se guardan con 3 decimales", () => {
    expect(roundQuantity(333 / 1000)).toBe(0.333);
    expect(roundQuantity(1 / 3)).toBe(0.333);
  });

  it("suma importes sin error acumulado", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
  });
});
