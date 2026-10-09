/** RF-03: asignación en bloque de marcas, rubros y etiquetas. Lógica pura. */

export type AssignKind = "brand" | "category" | "label";

export const KIND_LABELS: Record<AssignKind, string> = {
  brand: "la marca",
  category: "el rubro",
  label: "la etiqueta"
};

export interface AssignableProduct {
  id: string;
  name: string;
  brand_id: string | null;
  category_id: string | null;
  label_ids: string[];
}

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Filtra por nombre sin importar tildes ni mayúsculas; sin texto devuelve todos. */
export function selectableProducts(products: AssignableProduct[], query: string): AssignableProduct[] {
  const q = normalize(query);
  if (!q) return products;
  return products.filter((p) => normalize(p.name).includes(q));
}
