import type { CatalogProduct } from "./types";
import { exportToExcel } from "../../shared/export/excel";
import { effectivePrice } from "./branchPricing";

/** RF-05 + RF-69: el Excel lleva el precio de la sucursal de trabajo (sin sucursal: el base). */
export function exportCatalogToExcel(products: CatalogProduct[], filename = "catalogo-alverde", branchId: string | null = null) {
  const headers = ["Nombre", "Marca", "Rubro", "Unidad base", "Etiquetas", "Presentacion", "Precio de venta", "Codigo de barras"];
  const matrix: (string | number | null)[][] = [];

  for (const p of products) {
    const brand = p.brand?.name ?? "";
    const category = p.category?.name ?? "";
    const unitLabel: Record<string, string> = { gram: "gramos", millilitre: "ml", unit: "unidad" };
    const unit = unitLabel[p.base_unit] ?? p.base_unit;
    const labelNames = p.labels.map(l => l.name).join(", ");

    const activePresentations = p.presentations.filter(pr => pr.active);
    if (activePresentations.length === 0) {
      matrix.push([p.name, brand, category, unit, labelNames, "", "", ""]);
    } else {
      for (const pr of activePresentations) {
        matrix.push([
          p.name, brand, category, unit, labelNames,
          pr.name,
          effectivePrice(pr, branchId).toFixed(2),
          pr.internal_barcode ?? "",
        ]);
      }
    }
  }

  exportToExcel(headers, matrix, filename);
}
