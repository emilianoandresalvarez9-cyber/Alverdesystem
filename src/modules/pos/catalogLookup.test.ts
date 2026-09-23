import { describe, expect, it } from "vitest";
import { lookupBarcode, pricePerKilo, searchEntries } from "./catalogLookup";
import type { PosEntry } from "./types";

const entry = (over: Partial<PosEntry>): PosEntry => ({
  presentationId: "p", productId: "prod", productName: "Producto", presentationName: "Unidad",
  baseUnit: "unit", baseQuantity: 1, salePrice: 100, soldByWeight: false,
  internalBarcode: null, manufacturerBarcode: null, ...over
});

const entries = [
  entry({ presentationId: "garrapinada-150", productId: "g", productName: "Garrapiñada", presentationName: "150 g", internalBarcode: "2000000000015" }),
  entry({ presentationId: "yerba-1kg", productId: "y", productName: "Yerba", presentationName: "1 kg", manufacturerBarcode: "7790001000017" }),
  entry({ presentationId: "aceite-500", productId: "a", productName: "Aceite de oliva", presentationName: "500 ml", manufacturerBarcode: "7790002000014" }),
  entry({ presentationId: "aceite-1l", productId: "a", productName: "Aceite de oliva", presentationName: "1 l", manufacturerBarcode: "7790002000014" }),
  entry({ presentationId: "lentejas-granel", productId: "l", productName: "Lentejas", presentationName: "granel", baseUnit: "gram", baseQuantity: 1, salePrice: 3, soldByWeight: true, internalBarcode: "2100000000012" })
];

describe("lookupBarcode (RF-18 a RF-21)", () => {
  it("el código interno identifica la presentación", () => {
    expect(lookupBarcode(entries, "2000000000015")).toEqual({ kind: "found", entry: entries[0] });
  });

  it("el código del fabricante con una sola presentación la encuentra", () => {
    const result = lookupBarcode(entries, " 7790001000017 ");
    expect(result.kind === "found" && result.entry.presentationId).toBe("yerba-1kg");
  });

  it("el código del fabricante con varias presentaciones pide elegir", () => {
    const result = lookupBarcode(entries, "7790002000014");
    expect(result.kind).toBe("choose");
    expect(result.kind === "choose" && result.entries.map((e) => e.presentationId)).toEqual(["aceite-500", "aceite-1l"]);
  });

  it("un código desconocido no inventa un producto", () => {
    expect(lookupBarcode(entries, "123")).toEqual({ kind: "not_found", code: "123" });
  });
});

describe("búsqueda y precios", () => {
  it("busca sin distinguir tildes ni mayúsculas", () => {
    expect(searchEntries(entries, "garrapinada").map((e) => e.presentationId)).toEqual(["garrapinada-150"]);
    expect(searchEntries(entries, "a")).toEqual([]);
  });

  it("muestra el precio por kilo de un granel cargado por gramo", () => {
    expect(pricePerKilo(entries[4]!)).toBe(3000);
  });
});
