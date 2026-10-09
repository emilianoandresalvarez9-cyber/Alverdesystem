import { describe, expect, it } from "vitest";
import { selectableProducts, type AssignableProduct } from "./bulkAssign";

const products: AssignableProduct[] = [
  { id: "1", name: "Almendras Non Pareil", brand_id: null, category_id: null, label_ids: [] },
  { id: "2", name: "Semillas de chía", brand_id: "b1", category_id: null, label_ids: ["l1"] },
  { id: "3", name: "Aceite de coco", brand_id: null, category_id: "c1", label_ids: [] }
];

describe("RF-03: buscador de productos para asignar en bloque", () => {
  it("sin texto devuelve todos", () => {
    expect(selectableProducts(products, "  ")).toHaveLength(3);
  });

  it("ignora tildes y mayúsculas", () => {
    expect(selectableProducts(products, "CHIA").map((p) => p.id)).toEqual(["2"]);
    expect(selectableProducts(products, "almendras").map((p) => p.id)).toEqual(["1"]);
  });

  it("sin coincidencias devuelve vacío", () => {
    expect(selectableProducts(products, "lentejas")).toEqual([]);
  });
});
