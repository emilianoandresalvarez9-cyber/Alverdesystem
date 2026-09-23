// Tipos del catálogo — alineados con el esquema de Fase 0 (tablas en inglés)

export interface Brand {
  id: string;
  name: string;
  archived_at: string | null;
}

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  archived_at: string | null;
}

export interface Label {
  id: string;
  name: string;
  archived_at: string | null;
}

export interface ProductPresentation {
  id: string;
  name: string;
  base_quantity: number;
  internal_barcode: string | null;
  sale_price: number;
  /** Se vende pesando: la caja pide el peso (RF-22, RF-33). Ver docs/decisiones/ADR-001. */
  sold_by_weight: boolean;
  active: boolean;
}

export interface CatalogProduct {
  id: string;
  name: string;
  manufacturer_barcode: string | null;
  base_unit: "gram" | "millilitre" | "unit";
  open_shelf_life_days: number | null;
  label_text: string | null;
  active: boolean;
  brand: Brand | null;
  category: Category | null;
  labels: Label[];
  presentations: ProductPresentation[];
}

export interface CatalogFilters {
  search: string;
  brandId: string;
  categoryId: string;
  labelId: string;
}
