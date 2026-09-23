import { describe, expect, it } from "vitest";
import { buildSalePayload, cartReducer, cartTotal } from "./cart";
import type { CartLine, PosEntry } from "./types";

const unit: PosEntry = {
  presentationId: "bolsa", productId: "n", productName: "Nueces", presentationName: "250 g",
  baseUnit: "gram", baseQuantity: 250, salePrice: 1500, soldByWeight: false, internalBarcode: "1", manufacturerBarcode: null
};
const bulkPerKg: PosEntry = {
  ...unit, presentationId: "granel-kg", presentationName: "granel por kg", baseQuantity: 1000, salePrice: 3000, soldByWeight: true
};

let n = 0;
const id = () => `id-${++n}`;

describe("carrito", () => {
  it("agrupa productos por unidad en una línea", () => {
    let lines: CartLine[] = [];
    lines = cartReducer(lines, { type: "add", entry: unit, lineId: id() });
    lines = cartReducer(lines, { type: "add", entry: unit, lineId: id() });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(2);
    expect(cartTotal(lines)).toBe(3000);
  });

  it("RF-33: 350 g de un granel a $3000/kg suman $1050", () => {
    const lines = cartReducer([], { type: "addWeighed", entry: bulkPerKg, weight: 350, lineId: id() });
    expect(lines[0]?.quantity).toBe(0.35);
    expect(cartTotal(lines)).toBe(1050);
  });

  it("un producto por peso no se agrega sin peso", () => {
    expect(cartReducer([], { type: "add", entry: bulkPerKg, lineId: id() })).toEqual([]);
    expect(cartReducer([], { type: "addWeighed", entry: bulkPerKg, weight: 0, lineId: id() })).toEqual([]);
  });

  it("cantidad 0 quita la línea", () => {
    const lines = cartReducer([], { type: "add", entry: unit, lineId: "x" });
    expect(cartReducer(lines, { type: "setQuantity", lineId: "x", quantity: 0 })).toEqual([]);
  });
});

describe("buildSalePayload (contrato con process_offline_sale)", () => {
  const lines: CartLine[] = [
    { lineId: "a", entry: unit, quantity: 3 },
    { lineId: "b", entry: bulkPerKg, quantity: 0.35, weight: 350 }
  ];

  it("envía cantidades en unidades de presentación y el total que se mostró", () => {
    const payload = buildSalePayload(lines, { shiftId: "turno", paymentMethod: "qr", newId: id });
    expect(payload.totalAmount).toBe(5550);
    expect(payload.items.map((i) => [i.presentationId, i.quantity, i.unitPrice])).toEqual([
      ["bolsa", 3, 1500],
      ["granel-kg", 0.35, 3000]
    ]);
    expect(payload).not.toHaveProperty("customerId");
  });

  it("un fiado sin cliente no se arma", () => {
    expect(() => buildSalePayload(lines, { shiftId: "turno", paymentMethod: "credit", newId: id })).toThrow(/cliente/);
  });

  it("una venta vacía no se arma", () => {
    expect(() => buildSalePayload([], { shiftId: "turno", paymentMethod: "cash", newId: id })).toThrow();
  });
});
