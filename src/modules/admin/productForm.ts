import type { Database, Enums, Tables } from "../../shared/supabase/database.types";
import { normalizeManufacturerBarcode } from "./manufacturerBarcode";

type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type PresentationInsert = Database["public"]["Tables"]["product_presentations"]["Insert"];
type Product = Tables<"products">;

export interface ProductFormValues {
  name: string;
  barcode: string;
  brandId: string;
  categoryId: string;
  baseUnit: Enums<"base_unit">;
  multiplier: string;
}

export interface PresentationFormValues {
  name: string;
  baseQuantity: string;
  salePrice: string;
}

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: "", barcode: "", brandId: "", categoryId: "", baseUnit: "unit", multiplier: ""
};

export const EMPTY_PRESENTATION_FORM: PresentationFormValues = { name: "", baseQuantity: "", salePrice: "" };

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function productFormFrom(product: Product): ProductFormValues {
  return {
    name: product.name,
    barcode: product.manufacturer_barcode ?? "",
    brandId: product.brand_id ?? "",
    categoryId: product.category_id ?? "",
    baseUnit: product.base_unit ?? "unit",
    multiplier: product.price_multiplier == null ? "" : String(product.price_multiplier)
  };
}

/** Ficha del producto lista para insertar o actualizar. No toca `active`: archivar es otra acción. */
export function parseProductForm(values: ProductFormValues): Parsed<Omit<ProductInsert, "active">> {
  const name = values.name.trim();
  if (!name) return { ok: false, error: "Nombre obligatorio" };
  const multiplier = values.multiplier.trim() === "" ? null : Number(values.multiplier);
  if (multiplier !== null && (!Number.isFinite(multiplier) || multiplier <= 0)) {
    return { ok: false, error: "El multiplicador propio debe ser mayor que cero o quedar vacío para heredar." };
  }
  return {
    ok: true,
    value: {
      name,
      manufacturer_barcode: normalizeManufacturerBarcode(values.barcode),
      brand_id: values.brandId || null,
      category_id: values.categoryId || null,
      base_unit: values.baseUnit,
      price_multiplier: multiplier
    }
  };
}

/** Presentación sin el producto: la cantidad base es el contenido, no el stock. */
export function parsePresentationForm(values: PresentationFormValues): Parsed<Omit<PresentationInsert, "product_id">> {
  const name = values.name.trim();
  if (!name) return { ok: false, error: "Poné el nombre de la presentación (por ejemplo, «Frasco 500 g»)." };
  const baseQuantity = Number(values.baseQuantity);
  if (values.baseQuantity.trim() === "" || !Number.isFinite(baseQuantity) || baseQuantity <= 0) {
    return { ok: false, error: "La cantidad base tiene que ser mayor que cero." };
  }
  const salePrice = Number(values.salePrice);
  if (values.salePrice.trim() === "" || !Number.isFinite(salePrice) || salePrice < 0) {
    return { ok: false, error: "Ingresá un precio válido mayor o igual a 0." };
  }
  return { ok: true, value: { name, base_quantity: baseQuantity, sale_price: salePrice } };
}

type Failure = { message: string } | null;

/** Las dos escrituras del alta; la pantalla las hace con Supabase y los tests con una base en memoria. */
export interface ProductStore {
  insertProduct(payload: ProductInsert): Promise<{ data: Product | null; error: Failure }>;
  insertPresentation(payload: PresentationInsert): Promise<{ error: Failure }>;
}

export type CreateProductResult =
  | { kind: "created"; product: Product; presentationName: string }
  | { kind: "presentation_failed"; product: Product; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "failed"; message: string };

/**
 * Alta de un producto con su primera presentación. Sin presentación el producto no aparece en el
 * catálogo, en la caja ni en el ingreso de stock (employee_catalog exige una presentación activa),
 * así que se valida todo antes de escribir y se informa aparte si sólo falló la presentación.
 */
export async function createProductWithPresentation(
  store: ProductStore,
  productValues: ProductFormValues,
  presentationValues: PresentationFormValues
): Promise<CreateProductResult> {
  const product = parseProductForm(productValues);
  if (!product.ok) return { kind: "invalid", message: product.error };
  const presentation = parsePresentationForm(presentationValues);
  if (!presentation.ok) return { kind: "invalid", message: presentation.error };

  const { data, error } = await store.insertProduct({ ...product.value, active: true });
  if (error || !data) return { kind: "failed", message: error?.message ?? "No se pudo crear el producto." };

  const { error: presentationError } = await store.insertPresentation({ ...presentation.value, product_id: data.id });
  if (presentationError) return { kind: "presentation_failed", product: data, message: presentationError.message };
  return { kind: "created", product: data, presentationName: presentation.value.name };
}

export const MISSING_PRESENTATION_WARNING =
  "Este producto no tiene presentaciones activas: no aparece en la Caja, en el Catálogo ni en el Ingreso rápido de Stock. Agregale una abajo.";

/** Texto de cada producto en el selector: avisa los archivados y los que no se pueden vender. */
export function productOptionLabel(product: Pick<Product, "name" | "active">, hasActivePresentation: boolean): string {
  const notes = [product.active ? null : "archivado", hasActivePresentation ? null : "sin presentación"].filter(Boolean);
  return notes.length ? `${product.name} (${notes.join(", ")})` : product.name;
}

export function baseQuantityHelp(baseUnit: Enums<"base_unit">): string {
  const amount = baseUnit === "gram" ? "Cuántos gramos" : baseUnit === "millilitre" ? "Cuántos mililitros" : "Cuántas unidades";
  return `${amount} trae esta presentación. No es el stock: el stock se carga en Stock, Ingreso rápido.`;
}
