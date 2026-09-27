export interface SupplierSummary {
  id: string;
  name: string;
  contact: string | null;
}

export interface ProductSupplierLink {
  is_primary: boolean;
  supplier: SupplierSummary | SupplierSummary[] | null;
}

export function preferredSupplier(links: ProductSupplierLink[]): SupplierSummary | null {
  const primary = links.find((link) => link.is_primary) ?? links[0];
  if (!primary?.supplier) return null;
  return Array.isArray(primary.supplier) ? primary.supplier[0] ?? null : primary.supplier;
}
