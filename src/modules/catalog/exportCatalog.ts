import type { CatalogProduct } from "./types";

// Exporta el catálogo filtrado a Excel (RF-05)
// Usa solo APIs nativas del browser, sin dependencias externas.
export function exportCatalogToExcel(products: CatalogProduct[], filename = "catalogo-alverde") {
  const rows: string[][] = [
    ["Nombre", "Marca", "Rubro", "Unidad base", "Etiquetas",
     "Presentación", "Precio de venta", "Código de barras (presentación)"],
  ];

  for (const p of products) {
    const brand = p.brand?.name ?? "";
    const category = p.category?.name ?? "";
    const unitLabel: Record<string, string> = { gram: "gramos", millilitre: "ml", unit: "unidad" };
    const unit = unitLabel[p.base_unit] ?? p.base_unit;
    const labelNames = p.labels.map(l => l.name).join(", ");

    const activePresentations = p.presentations.filter(pr => pr.active);
    if (activePresentations.length === 0) {
      rows.push([p.name, brand, category, unit, labelNames, "", "", ""]);
    } else {
      for (const pr of activePresentations) {
        rows.push([
          p.name, brand, category, unit, labelNames,
          pr.name,
          pr.sale_price.toFixed(2),
          pr.internal_barcode ?? "",
        ]);
      }
    }
  }

  // Generar CSV con BOM UTF-8 para que Excel lo abra correctamente
  const csv = "\uFEFF" + rows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")
  ).join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
