import type { CatalogProduct } from "../catalog/types";
import type { PosEntry } from "./types";

export type LookupResult =
  | { kind: "found"; entry: PosEntry }
  | { kind: "choose"; entries: PosEntry[] }
  | { kind: "not_found"; code: string };

export function toPosEntries(products: CatalogProduct[]): PosEntry[] {
  return products.flatMap((product) =>
    product.presentations
      .filter((presentation) => presentation.active)
      .map((presentation) => ({
        presentationId: presentation.id,
        productId: product.id,
        productName: product.name,
        presentationName: presentation.name,
        baseUnit: product.base_unit,
        baseQuantity: Number(presentation.base_quantity),
        salePrice: Number(presentation.sale_price),
        soldByWeight: Boolean(presentation.sold_by_weight),
        internalBarcode: presentation.internal_barcode,
        manufacturerBarcode: product.manufacturer_barcode
      }))
  );
}

/**
 * Busca un código escaneado (RF-18). Primero el código interno de la presentación (RF-20, RF-21:
 * identifica producto y presentación); después el del fabricante (RF-19), que identifica solo el
 * producto: si ese producto tiene varias presentaciones, la caja tiene que preguntar cuál.
 */
export function lookupBarcode(entries: PosEntry[], rawCode: string): LookupResult {
  const code = rawCode.trim();
  if (!code) return { kind: "not_found", code };

  const byInternal = entries.find((entry) => entry.internalBarcode === code);
  if (byInternal) return { kind: "found", entry: byInternal };

  const byManufacturer = entries.filter((entry) => entry.manufacturerBarcode === code);
  if (byManufacturer.length === 1 && byManufacturer[0]) return { kind: "found", entry: byManufacturer[0] };
  if (byManufacturer.length > 1) return { kind: "choose", entries: byManufacturer };

  return { kind: "not_found", code };
}

/** Búsqueda por nombre para productos sin código a mano. */
export function searchEntries(entries: PosEntry[], text: string, limit = 8): PosEntry[] {
  const needle = normalize(text);
  if (needle.length < 2) return [];
  return entries
    .filter((entry) => normalize(`${entry.productName} ${entry.presentationName}`).includes(needle))
    .slice(0, limit);
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Precio por kilo o litro para mostrar en productos que se venden por peso. */
export function pricePerKilo(entry: PosEntry): number {
  return (entry.salePrice / entry.baseQuantity) * 1000;
}
