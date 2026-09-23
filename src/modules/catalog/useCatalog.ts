import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { loadCatalogSnapshot, saveCatalogSnapshot } from "../../shared/offline/queue";
import type { CatalogProduct, Brand, Category, Label, CatalogFilters } from "./types";

export interface UseCatalogReturn {
  products: CatalogProduct[];
  brands: Brand[];
  categories: Category[];
  labels: Label[];
  filters: CatalogFilters;
  setFilters: (f: Partial<CatalogFilters>) => void;
  isOffline: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY_FILTERS: CatalogFilters = { search: "", brandId: "", categoryId: "", labelId: "" };

export function useCatalog(): UseCatalogReturn {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [filters, setFiltersState] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setFilters = useCallback((partial: Partial<CatalogFilters>) => {
    setFiltersState(prev => ({ ...prev, ...partial }));
  }, []);

  const fetchFromSupabase = useCallback(async () => {
    const sb = getSupabase();

    const [productsRes, brandsRes, categoriesRes, labelsRes] = await Promise.all([
      sb.from("products")
        .select(`
          id, name, manufacturer_barcode, base_unit, open_shelf_life_days, label_text, active,
          brand:brands(id, name, archived_at),
          category:categories(id, name, parent_id, archived_at),
          labels:product_labels(label:labels(id, name, archived_at)),
          presentations:product_presentations(id, name, base_quantity, internal_barcode, sale_price, active)
        `)
        .eq("active", true)
        .order("name"),
      sb.from("brands").select("id, name, archived_at").is("archived_at", null).order("name"),
      sb.from("categories").select("id, name, parent_id, archived_at").is("archived_at", null).order("name"),
      sb.from("labels").select("id, name, archived_at").is("archived_at", null).order("name"),
    ]);

    if (productsRes.error) throw new Error(productsRes.error.message);

    // Normalizar la estructura de labels (viene como product_labels > label)
    const normalized = (productsRes.data ?? []).map((p: any) => ({
      ...p,
      labels: (p.labels ?? []).map((pl: any) => pl.label).filter(Boolean),
    })) as CatalogProduct[];

    return {
      products: normalized,
      brands: (brandsRes.data ?? []) as Brand[],
      categories: (categoriesRes.data ?? []) as Category[],
      labels: (labelsRes.data ?? []) as Label[],
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchFromSupabase();
      setProducts(data.products);
      setBrands(data.brands);
      setCategories(data.categories);
      setLabels(data.labels);
      // Persistir snapshot offline (rows: unknown[])
      await saveCatalogSnapshot(data.products);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar el catálogo";
      setError(msg);
      // Intentar cargar desde caché offline
      const snap = await loadCatalogSnapshot();
      if (snap && snap.rows) {
        setProducts(snap.rows as unknown as CatalogProduct[]);
        setIsOffline(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchFromSupabase]);

  useEffect(() => {
    const onOnline = () => { setIsOffline(false); refresh(); };
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { products, brands, categories, labels, filters, setFilters, isOffline, isLoading, error, refresh };
}

// Filtrado client-side (RF-04): busqueda + marca + rubro + etiqueta, combinables
export function filterProducts(products: CatalogProduct[], filters: CatalogFilters): CatalogProduct[] {
  const search = filters.search.toLowerCase().trim();
  return products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search) &&
        !p.manufacturer_barcode?.includes(search) &&
        !p.presentations.some(pr => pr.internal_barcode?.includes(search))) return false;
    if (filters.brandId && p.brand?.id !== filters.brandId) return false;
    if (filters.categoryId && p.category?.id !== filters.categoryId) return false;
    if (filters.labelId && !p.labels.some(l => l.id === filters.labelId)) return false;
    return true;
  });
}
