import type { CatalogProduct } from "./types";
import { exportToExcel } from "../../shared/export/excel";
import { effectivePrice } from "./branchPricing";
import { pricePerKiloFromGram } from "./scalePricing";

export const CATALOG_EXPORT_HEADERS = ["Nombre", "Marca", "Rubro", "Unidad base", "Etiquetas", "Presentacion", "Precio de venta", "Precio por", "Codigo de barras"];

const UNIT_LABEL: Record<string, string> = { gram: "gramos", millilitre: "ml", unit: "unidad" };

/**
 * Filas del Excel del catálogo. RF-05: el precio coincide con el que se ve en pantalla, así que una
 * presentación de Balanza va por kilo (la base lo guarda por gramo, ADR-001) y la columna
 * «Precio por» dice si es por kilo o por unidad. RF-69: precio de la sucursal de trabajo.
 */
export function catalogExportRows(products: readonly CatalogProduct[], branchId: string | null = null): (string | number | null)[][] {
  const matrix: (string | number | null)[][] = [];

  for (const p of products) {
    const brand = p.brand?.name ?? "";
    const category = p.category?.name ?? "";
    const unit = UNIT_LABEL[p.base_unit] ?? p.base_unit;
    const labelNames = p.labels.map(l => l.name).join(", ");

    const activePresentations = p.presentations.filter(pr => pr.active);
    if (activePresentations.length === 0) {
      matrix.push([p.name, brand, category, unit, labelNames, "", "", "", ""]);
    } else {
      for (const pr of activePresentations) {
        const price = effectivePrice(pr, branchId);
        matrix.push([
          p.name, brand, category, unit, labelNames,
          pr.name,
          (pr.sold_by_weight ? pricePerKiloFromGram(price) : price).toFixed(2),
          pr.sold_by_weight ? "kilo" : "unidad",
          pr.internal_barcode ?? "",
        ]);
      }
    }
  }

  return matrix;
}

/** RF-05 + RF-69: el Excel lleva el precio de la sucursal de trabajo (sin sucursal: el base). */
export function exportCatalogToExcel(products: CatalogProduct[], filename = "catalogo-alverde", branchId: string | null = null) {
  exportToExcel(CATALOG_EXPORT_HEADERS, catalogExportRows(products, branchId), filename);
}
