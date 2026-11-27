import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOG_EXPORT_HEADERS, catalogExportRows } from "./exportCatalog";
import type { CatalogProduct } from "./types";

const product = (patch: Partial<CatalogProduct>): CatalogProduct => ({
  id: "p1", name: "Lentejas", manufacturer_barcode: null, base_unit: "gram", open_shelf_life_days: null, label_text: null,
  active: true, brand: { id: "b1", name: "Del local", archived_at: null }, category: { id: "c1", name: "Legumbres", archived_at: null, parent_id: null },
  labels: [{ id: "l1", name: "Sin TACC", archived_at: null }], presentations: [], ...patch
} as CatalogProduct);

const granel = { id: "g", name: "Granel", base_quantity: 1, internal_barcode: "2000000000015", sale_price: 3.2, sold_by_weight: true, active: true, branch_prices: { norte: 3.5 } };
const bolsa = { id: "b", name: "Bolsa 500 g", base_quantity: 500, internal_barcode: null, sale_price: 1900, sold_by_weight: false, active: true };
const inactiva = { id: "i", name: "Vieja", base_quantity: 100, internal_barcode: null, sale_price: 500, sold_by_weight: false, active: false };

const col = (name: string) => CATALOG_EXPORT_HEADERS.indexOf(name);

describe("Excel del catálogo (RF-05)", () => {
  const rows = catalogExportRows([product({ presentations: [granel, bolsa, inactiva] })]);

  it("una fila por presentación activa, con los datos del producto", () => {
    expect(rows).toHaveLength(2);
    expect(rows[0]!.slice(0, 6)).toEqual(["Lentejas", "Del local", "Legumbres", "gramos", "Sin TACC", "Granel"]);
    expect(rows.every((row) => row.length === CATALOG_EXPORT_HEADERS.length)).toBe(true);
  });

  it("C-03: Balanza sale por kilo, como en la tarjeta, y no por gramo", () => {
    expect(rows[0]![col("Precio de venta")]).toBe("3200.00");
    expect(rows[0]![col("Precio por")]).toBe("kilo");
    expect(rows[0]![col("Codigo de barras")]).toBe("2000000000015");
  });

  it("una presentación por unidad conserva su precio", () => {
    expect(rows[1]![col("Precio de venta")]).toBe("1900.00");
    expect(rows[1]![col("Precio por")]).toBe("unidad");
  });

  it("RF-69: con sucursal usa su precio propio, también por kilo", () => {
    const norte = catalogExportRows([product({ presentations: [granel, bolsa] })], "norte");
    expect(norte[0]![col("Precio de venta")]).toBe("3500.00");
    expect(norte[1]![col("Precio de venta")]).toBe("1900.00");
  });

  it("un producto sin presentaciones activas queda en una fila sin precio", () => {
    const empty = catalogExportRows([product({ presentations: [inactiva] })]);
    expect(empty).toEqual([["Lentejas", "Del local", "Legumbres", "gramos", "Sin TACC", "", "", "", ""]]);
  });
});

describe("Administración → Precios (C-03)", () => {
  it("«Precio actual» usa el mismo texto que el catálogo (por kilo en Balanza)", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/admin/ProductPricing.tsx"), "utf8");
    expect(source).toMatch(/<td className="num">\{presentationPriceLabel\(\{ sale_price: Number\(presentation\.sale_price\), sold_by_weight: presentation\.sold_by_weight \}, formatMoney\)\}<\/td>/);
    expect(source).not.toMatch(/<td className="num">\{formatMoney\(Number\(presentation\.sale_price\)\)\}<\/td>/);
  });
});
