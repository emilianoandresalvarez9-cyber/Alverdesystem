import type { CatalogProduct } from "../catalog/types";
import type { PresentationLookupResult } from "./types";

/**
 * Presentaciones que puede ingresar un código escaneado. El código interno identifica una sola
 * presentación (RF-20, RF-21). El del fabricante identifica el producto (RF-19): si el producto
 * tiene varias presentaciones vuelven todas, de menor a mayor contenido, para que se elija cuál entra.
 */
export function presentationsForCode(entries: PresentationLookupResult[], rawCode: string): PresentationLookupResult[] {
  const code = rawCode.trim();
  if (!code) return [];
  const internal = entries.find((entry) => entry.internal_barcode === code);
  if (internal) return [internal];
  return entries
    .filter((entry) => entry.manufacturer_barcode === code)
    .sort((left, right) => left.base_quantity - right.base_quantity);
}

/** Las mismas entradas a partir del catálogo guardado en el dispositivo (búsqueda sin conexión). */
export function lookupEntriesFromCatalog(products: CatalogProduct[]): PresentationLookupResult[] {
  return products.flatMap((product) =>
    product.presentations.map((presentation) => ({
      presentation_id: presentation.id,
      presentation_name: presentation.name,
      product_id: product.id,
      product_name: product.name,
      base_quantity: presentation.base_quantity,
      sale_price: presentation.sale_price,
      internal_barcode: presentation.internal_barcode,
      manufacturer_barcode: product.manufacturer_barcode,
      base_unit: product.base_unit,
      sold_by_weight: presentation.sold_by_weight,
      open_shelf_life_days: product.open_shelf_life_days
    }))
  );
}
