import { describe, expect, it } from "vitest";
import type { Product } from "../../shared/types";
import {
  EMPTY_PRESENTATION_FORM, EMPTY_PRODUCT_FORM, baseQuantityHelp, createProductWithPresentation, parsePresentationForm, parseProductForm,
  productOptionLabel, type ProductStore
} from "./productForm";

/** Base en memoria con las dos escrituras del alta; registra el orden en que llegan. */
function memoryStore(failures: { product?: string; presentation?: string } = {}) {
  const writes: string[] = [];
  const products: Product[] = [];
  const presentations: { product_id: string; name: string; base_quantity: number; sale_price?: number }[] = [];
  const store: ProductStore = {
    async insertProduct(payload) {
      writes.push(`product:${payload.name}`);
      if (failures.product) return { data: null, error: { message: failures.product } };
      const row = { id: `p${products.length + 1}`, active: true, ...payload } as Product;
      products.push(row);
      return { data: row, error: null };
    },
    async insertPresentation(payload) {
      writes.push(`presentation:${payload.name}`);
      if (failures.presentation) return { error: { message: failures.presentation } };
      presentations.push(payload);
      return { error: null };
    }
  };
  return { store, writes, products, presentations };
}

const arveja = { ...EMPTY_PRODUCT_FORM, name: " Arveja ", barcode: "7798138552838" };
const lata = { name: "Lata 300 g", baseQuantity: "1", salePrice: "1500" };

describe("Alta de producto con su primera presentación", () => {
  it("crea el producto y después su presentación, atada al producto creado", async () => {
    const db = memoryStore();
    const result = await createProductWithPresentation(db.store, arveja, lata);
    expect(result).toMatchObject({ kind: "created", presentationName: "Lata 300 g" });
    expect(db.writes).toEqual(["product:Arveja", "presentation:Lata 300 g"]);
    expect(db.products[0]).toMatchObject({ name: "Arveja", manufacturer_barcode: "7798138552838", active: true });
    expect(db.presentations).toEqual([{ product_id: "p1", name: "Lata 300 g", base_quantity: 1, sale_price: 1500 }]);
  });

  it("tres altas seguidas dejan tres productos, cada uno con su presentación", async () => {
    const db = memoryStore();
    for (const name of ["Avena", "Arroz", "Lentejas"]) {
      const result = await createProductWithPresentation(db.store, { ...EMPTY_PRODUCT_FORM, name }, lata);
      expect(result.kind).toBe("created");
    }
    expect(db.products.map((p) => p.name)).toEqual(["Avena", "Arroz", "Lentejas"]);
    expect(db.presentations.map((p) => p.product_id)).toEqual(["p1", "p2", "p3"]);
  });

  it("sin presentación válida no escribe nada: no deja un producto que no aparece en Caja ni Stock", async () => {
    const db = memoryStore();
    expect(await createProductWithPresentation(db.store, arveja, EMPTY_PRESENTATION_FORM)).toEqual({
      kind: "invalid", message: "Poné el nombre de la presentación (por ejemplo, «Frasco 500 g»)."
    });
    expect(await createProductWithPresentation(db.store, arveja, { ...lata, baseQuantity: "0" })).toMatchObject({ kind: "invalid" });
    expect(await createProductWithPresentation(db.store, arveja, { ...lata, salePrice: "" })).toMatchObject({ kind: "invalid" });
    expect(db.writes).toEqual([]);
  });

  it("sin nombre de producto tampoco escribe", async () => {
    const db = memoryStore();
    expect(await createProductWithPresentation(db.store, { ...arveja, name: "  " }, lata)).toEqual({ kind: "invalid", message: "Nombre obligatorio" });
    expect(db.writes).toEqual([]);
  });

  it("si la base rechaza el producto, no intenta la presentación", async () => {
    const db = memoryStore({ product: 'duplicate key value violates unique constraint "products_manufacturer_barcode_key"' });
    const result = await createProductWithPresentation(db.store, arveja, lata);
    expect(result).toEqual({ kind: "failed", message: 'duplicate key value violates unique constraint "products_manufacturer_barcode_key"' });
    expect(db.writes).toEqual(["product:Arveja"]);
  });

  it("si sólo falla la presentación, devuelve el producto creado para completarlo", async () => {
    const db = memoryStore({ presentation: "permission denied for table product_presentations" });
    const result = await createProductWithPresentation(db.store, arveja, lata);
    expect(result).toMatchObject({ kind: "presentation_failed", message: "permission denied for table product_presentations" });
    expect(result.kind === "presentation_failed" && result.product.id).toBe("p1");
  });
});

describe("Ficha del producto", () => {
  it("guardar cambios no manda `active`: editar un producto archivado no lo reactiva", () => {
    const parsed = parseProductForm(arveja);
    expect(parsed.ok && parsed.value).toEqual({
      name: "Arveja", manufacturer_barcode: "7798138552838", brand_id: null, category_id: null, base_unit: "unit", price_multiplier: null
    });
    expect(parsed.ok && "active" in parsed.value).toBe(false);
  });

  it("el multiplicador propio vacío hereda y uno no positivo se rechaza", () => {
    expect(parseProductForm({ ...arveja, multiplier: "1.8" })).toMatchObject({ ok: true, value: { price_multiplier: 1.8 } });
    expect(parseProductForm({ ...arveja, multiplier: "0" })).toMatchObject({ ok: false });
  });

  it("la presentación acepta precio 0 y rechaza cantidades negativas", () => {
    expect(parsePresentationForm({ ...lata, salePrice: "0" })).toMatchObject({ ok: true, value: { sale_price: 0 } });
    expect(parsePresentationForm({ ...lata, baseQuantity: "-1" })).toMatchObject({ ok: false });
  });

  it("la ayuda de cantidad base dice en qué unidad va y que no es el stock", () => {
    expect(baseQuantityHelp("unit")).toBe("Cuántas unidades trae esta presentación. No es el stock: el stock se carga en Stock, Ingreso rápido.");
    expect(baseQuantityHelp("gram")).toMatch(/^Cuántos gramos trae/);
    expect(baseQuantityHelp("millilitre")).toMatch(/^Cuántos mililitros trae/);
  });

  it("el selector marca los productos archivados y los que no tienen presentación", () => {
    expect(productOptionLabel({ name: "Arveja", active: true }, false)).toBe("Arveja (sin presentación)");
    expect(productOptionLabel({ name: "arvejas", active: false }, false)).toBe("arvejas (archivado, sin presentación)");
    expect(productOptionLabel({ name: "mayonesa", active: true }, true)).toBe("mayonesa");
  });
});
