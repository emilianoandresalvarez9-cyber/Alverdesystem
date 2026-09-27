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
      categoryName: "Bebidas"
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

  it("no incluye ventas anuladas ni filas sin producto relacionado", () => {
    const lines = toSalesReportLines([
      row({ sale: { occurred_at: "2026-09-27T14:00:00.000Z", status: "voided" } }),
      row({ presentation: null })
    ]);
    expect(lines).toEqual([]);
    expect(buildSalesReport(lines).productRanking).toEqual([]);
  });
});
