import { describe, expect, it } from "vitest";
import { buildSalesReport, toSalesReportLines, type SalesReportRow } from "./salesReport";

const row = (overrides: Partial<SalesReportRow> = {}): SalesReportRow => ({
  quantity: 2,
  unit_price: 10,
  sale: { occurred_at: "2026-09-27T14:00:00.000Z", status: "closed" },
  presentation: {
    product: {
      id: "product-1",
      name: "Agua",
      category_id: "category-1",
      category: { name: "Bebidas" }
    }
  },
  ...overrides
});

describe("reportes de ventas (RF-61 a RF-64)", () => {
  it("resuelve la relación venta → ítem → presentación → producto", () => {
    expect(toSalesReportLines([row()])).toEqual([{
      saleDate: "2026-09-27T14:00:00.000Z",
      quantity: 2,
      unitPrice: 10,
      productId: "product-1",
      productName: "Agua",
      categoryId: "category-1",
      categoryName: "Bebidas",
      labels: []
    }]);
  });

  it("agrupa ventas, productos y rubros a partir de cantidades por precio unitario", () => {
    const report = buildSalesReport([
      ...toSalesReportLines([row()]),
      ...toSalesReportLines([row({ quantity: 3, unit_price: 20 })])
    ]);

    expect(report.salesByDay).toHaveLength(1);
    expect(report.salesByDay[0]?.total).toBe(80);
    expect(report.productRanking).toEqual([{ name: "Agua", quantity: 5, revenue: 80 }]);
    expect(report.categoryDemand).toEqual([{ categoryId: "category-1", name: "Bebidas", value: 80 }]);
  });

  it("RF-63: demanda por etiqueta como proporción de lo vendido, sin duplicar productos con varias etiquetas", () => {
    const sinTacc = { id: "label-1", name: "Sin TACC" };
    const vegano = { id: "label-2", name: "Vegano" };
    const report = buildSalesReport(toSalesReportLines([
      // $40 con dos etiquetas
      row({ quantity: 2, unit_price: 20, presentation: { product: {
        id: "p1", name: "Galletas", category_id: null, category: null,
        product_labels: [{ label: sinTacc }, { label: vegano }] } } }),
      // $60 solo vegano
      row({ quantity: 3, unit_price: 20, presentation: { product: {
        id: "p2", name: "Hummus", category_id: null, category: null, product_labels: [{ label: vegano }] } } }),
      // $100 sin etiquetas
      row({ quantity: 5, unit_price: 20 })
    ]));

    expect(report.totalRevenue).toBe(200);
    expect(report.labelDemand).toEqual([
      { labelId: "label-2", name: "Vegano", value: 100, share: 0.5 },
      { labelId: "label-1", name: "Sin TACC", value: 40, share: 0.2 }
    ]);
  });

  it("no incluye ventas anuladas ni filas sin producto relacionado", () => {
    const lines = toSalesReportLines([
      row({ sale: { occurred_at: "2026-09-27T14:00:00.000Z", status: "voided" } }),
      row({ presentation: null })
    ]);
    expect(lines).toEqual([]);
    expect(buildSalesReport(lines).productRanking).toEqual([]);
  });
});
