import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "../catalog/types";
import { lookupEntriesFromCatalog, presentationsForCode } from "./presentationLookup";

const yerba: CatalogProduct = {
  id: "yerba", name: "Yerba orgánica", manufacturer_barcode: "7790000000017", base_unit: "unit",
  open_shelf_life_days: null, label_text: null, active: true, brand: null, category: null, labels: [],
  presentations: [
    { id: "caja", name: "Caja x12", base_quantity: 12, internal_barcode: null, sale_price: 36000, sold_by_weight: false, active: true },
    { id: "paquete", name: "Paquete 1 kg", base_quantity: 1, internal_barcode: null, sale_price: 3200, sold_by_weight: false, active: true },
    { id: "pack", name: "Pack x3", base_quantity: 3, internal_barcode: "2000000000015", sale_price: 9300, sold_by_weight: false, active: true }
  ]
} as CatalogProduct;

const entries = lookupEntriesFromCatalog([yerba]);

describe("Ingreso rápido: qué presentaciones trae un código", () => {
  it("el código del fabricante trae todas las presentaciones del producto, de menor a mayor", () => {
    expect(presentationsForCode(entries, "7790000000017").map((e) => e.presentation_name)).toEqual(["Paquete 1 kg", "Pack x3", "Caja x12"]);
  });

  it("el código interno trae sólo su presentación", () => {
    expect(presentationsForCode(entries, " 2000000000015 ").map((e) => e.presentation_id)).toEqual(["pack"]);
  });

  it("un código desconocido o vacío no trae nada", () => {
    expect(presentationsForCode(entries, "123")).toEqual([]);
    expect(presentationsForCode(entries, "  ")).toEqual([]);
  });

  it("las entradas del catálogo guardado llevan producto, unidad y si se vende por peso", () => {
    expect(entries.find((e) => e.presentation_id === "caja")).toEqual({
      presentation_id: "caja", presentation_name: "Caja x12", product_id: "yerba", product_name: "Yerba orgánica",
      base_quantity: 12, sale_price: 36000, internal_barcode: null, manufacturer_barcode: "7790000000017",
      base_unit: "unit", sold_by_weight: false, open_shelf_life_days: null
    });
  });
});
