import { describe, expect, it } from "vitest";
import { filterProducts } from "./useCatalog";
import type { CatalogFilters, CatalogProduct } from "./types";

const brand = (id: string, name: string) => ({ id, name, archived_at: null });
const label = (id: string, name: string) => ({ id, name, archived_at: null });
const category = (id: string, name: string) => ({ id, name, parent_id: null, archived_at: null });

const product = (over: Partial<CatalogProduct>): CatalogProduct => ({
  id: "p", name: "Producto", manufacturer_barcode: null, base_unit: "gram", open_shelf_life_days: null,
  label_text: null, active: true, brand: null, category: null, labels: [], presentations: [], ...over
});

const nuez = product({ id: "nuez", name: "Nuez mariposa", brand: brand("b1", "Del local"), category: category("c1", "Frutos secos"),
  labels: [label("l1", "Sin TACC"), label("l2", "Vegano")],
  presentations: [{ id: "n1", name: "Granel", base_quantity: 1, internal_barcode: "2000001", sale_price: 14.8, sold_by_weight: true, active: true }] });
const aceite = product({ id: "aceite", name: "Aceite de coco", manufacturer_barcode: "7791234567890", brand: brand("b2", "NutriVida"),
  category: category("c3", "Aceites"), labels: [label("l3", "Orgánico")] });
const chia = product({ id: "chia", name: "Semillas de chía", brand: brand("b3", "Molino Serena"), category: category("c2", "Semillas"),
  labels: [label("l2", "Vegano")] });
const all = [nuez, aceite, chia];
const none: CatalogFilters = { search: "", brandId: "", categoryId: "", labelId: "" };
const ids = (filters: Partial<CatalogFilters>) => filterProducts(all, { ...none, ...filters }).map((p) => p.id);

describe("RF-04: filtros del catálogo combinables", () => {
  it("sin filtros muestra todo", () => {
    expect(ids({})).toEqual(["nuez", "aceite", "chia"]);
  });

  it("cada eje filtra y los ejes se combinan", () => {
    expect(ids({ labelId: "l2" })).toEqual(["nuez", "chia"]);
    expect(ids({ labelId: "l2", categoryId: "c1" })).toEqual(["nuez"]);
    expect(ids({ brandId: "b2" })).toEqual(["aceite"]);
    expect(ids({ brandId: "b2", labelId: "l2" })).toEqual([]);
  });

  it("busca por nombre, marca o código (fabricante o interno), como dice el buscador", () => {
    expect(ids({ search: "CHÍA" })).toEqual(["chia"]);
    expect(ids({ search: "nutrivida" })).toEqual(["aceite"]);
    expect(ids({ search: "7791234567890" })).toEqual(["aceite"]);
    expect(ids({ search: "2000001" })).toEqual(["nuez"]);
    expect(ids({ search: "molino", labelId: "l3" })).toEqual([]);
  });
});
