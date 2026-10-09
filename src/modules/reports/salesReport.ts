/** Etiqueta embebida en product_labels(label:labels(id, name)). */
export interface SalesReportLabelRow {
  label: { id: string; name: string } | { id: string; name: string }[] | null;
}

export interface SalesReportProductRow {
  id: string;
  name: string;
  category_id: string | null;
  category: { name: string } | { name: string }[] | null;
  product_labels?: SalesReportLabelRow[] | null;
}

export interface SalesReportRow {
  quantity: number | string;
  unit_price: number | string;
  sale: { occurred_at: string; status: string } | { occurred_at: string; status: string }[] | null;
  presentation: {
    product: SalesReportProductRow | SalesReportProductRow[] | null;
  } | {
    product: SalesReportProductRow | SalesReportProductRow[] | null;
  }[] | null;
}

export interface SalesReportLine {
  saleDate: string;
  quantity: number;
  unitPrice: number;
  productId: string;
  productName: string;
  categoryId: string | null;
  categoryName: string | null;
  labels: { id: string; name: string }[];
}

export interface SalesReport {
  salesByDay: { date: string; total: number }[];
  productRanking: { name: string; quantity: number; revenue: number }[];
  categoryDemand: { categoryId: string; name: string; value: number }[];
  /** RF-63: qué proporción de lo vendido lleva cada etiqueta (un producto puede tener varias). */
  labelDemand: { labelId: string; name: string; value: number; share: number }[];
  totalRevenue: number;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function toSalesReportLines(rows: SalesReportRow[]): SalesReportLine[] {
  const lines: SalesReportLine[] = [];

  for (const row of rows) {
    const sale = one(row.sale);
    const presentation = one(row.presentation);
    const product = one(presentation?.product ?? null);
    const category = one(product?.category ?? null);
    if (!sale || !product || sale.status !== "closed") continue;

    lines.push({
      saleDate: sale.occurred_at,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      productId: product.id,
      productName: product.name,
      categoryId: product.category_id,
      categoryName: category?.name ?? null,
      labels: (product.product_labels ?? [])
        .map((row) => one(row.label))
        .filter((label): label is { id: string; name: string } => label !== null)
    });
  }

  return lines;
}

export function buildSalesReport(lines: SalesReportLine[]): SalesReport {
  const daily = new Map<string, number>();
  const products = new Map<string, { name: string; quantity: number; revenue: number }>();
  const categories = new Map<string, { name: string; value: number }>();
  const labels = new Map<string, { name: string; value: number }>();
  let totalRevenue = 0;

  for (const line of lines) {
    const day = line.saleDate.slice(0, 10);
    const revenue = line.quantity * line.unitPrice;
    totalRevenue += revenue;
    daily.set(day, (daily.get(day) ?? 0) + revenue);

    for (const label of line.labels) {
      const current = labels.get(label.id) ?? { name: label.name, value: 0 };
      current.value += revenue;
      labels.set(label.id, current);
    }

    const currentProduct = products.get(line.productId) ?? { name: line.productName, quantity: 0, revenue: 0 };
    currentProduct.quantity += line.quantity;
    currentProduct.revenue += revenue;
    products.set(line.productId, currentProduct);

    if (line.categoryId) {
      const currentCategory = categories.get(line.categoryId) ?? { name: line.categoryName ?? "Sin Rubro", value: 0 };
      currentCategory.value += revenue;
      categories.set(line.categoryId, currentCategory);
    }
  }

  return {
    salesByDay: Array.from(daily.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([day, total]) => ({
        date: new Date(`${day}T12:00:00`).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" }),
        total
      })),
    productRanking: Array.from(products.values())
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 10),
    categoryDemand: Array.from(categories.entries())
      .map(([categoryId, category]) => ({ categoryId, ...category }))
      .sort((left, right) => right.value - left.value),
    labelDemand: Array.from(labels.entries())
      .map(([labelId, label]) => ({ labelId, ...label, share: totalRevenue > 0 ? label.value / totalRevenue : 0 }))
      .sort((left, right) => right.value - left.value),
    totalRevenue
  };
}
