import { describe, expect, it } from "vitest";
import { formatMoney, lineSubtotal, roundQuantity, sumMoney } from "./money";

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

describe("money: formato argentino del sistema de diseño", () => {
  it("sin centavos cuando no los hay, con punto de miles y sin espacio", () => {
    expect(formatMoney(17120)).toBe("$17.120");
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(1500000)).toBe("$1.500.000");
  });

  it("muestra los centavos cuando existen: nunca esconde lo que se cobra", () => {
    expect(formatMoney(4928.4)).toBe("$4.928,40");
    expect(formatMoney(0.35 * 3000)).toBe("$1.050");
  });

  it("negativos con signo menos tipográfico", () => {
    expect(formatMoney(-200)).toBe("−$200");
    expect(formatMoney(-0.001)).toBe("$0");
  });
});
