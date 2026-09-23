import { useRef, useCallback } from "react";
import { TextField, SelectField, Button } from "../../shared/ui";
import type { Brand, Category, Label, CatalogFilters } from "./types";

interface CatalogFiltersBarProps {
  filters: CatalogFilters;
  setFilters: (f: Partial<CatalogFilters>) => void;
  brands: Brand[];
  categories: Category[];
  labels: Label[];
  onExport: () => void;
}

export function CatalogFiltersBar({
  filters, setFilters, brands, categories, labels, onExport,
}: CatalogFiltersBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  const clearAll = useCallback(() => {
    setFilters({ search: "", brandId: "", categoryId: "", labelId: "" });
    searchRef.current?.focus();
  }, [setFilters]);

  const hasActiveFilters = filters.search || filters.brandId || filters.categoryId || filters.labelId;

  return (
    <div className="catalog-filters">
      <TextField
        ref={searchRef}
        label=""
        placeholder="Buscar por nombre o código de barras…"
        value={filters.search}
        onChange={v => setFilters({ search: v })}
        className="catalog-filters__search"
        aria-label="Buscar producto"
      />
      <div className="catalog-filters__row">
        <SelectField
          label="Marca"
          value={filters.brandId}
          onChange={v => setFilters({ brandId: v })}
          options={[
            { value: "", label: "Todas las marcas" },
            ...brands.map(b => ({ value: b.id, label: b.name })),
          ]}
        />
        <SelectField
          label="Rubro"
          value={filters.categoryId}
          onChange={v => setFilters({ categoryId: v })}
          options={[
            { value: "", label: "Todos los rubros" },
            ...categories.map(c => ({ value: c.id, label: c.name })),
          ]}
        />
        <SelectField
          label="Etiqueta"
          value={filters.labelId}
          onChange={v => setFilters({ labelId: v })}
          options={[
            { value: "", label: "Todas las etiquetas" },
            ...labels.map(l => ({ value: l.id, label: l.name })),
          ]}
        />
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearAll} style={{ alignSelf: "flex-end" }}>
            Limpiar filtros
          </Button>
        )}
        <Button variant="secondary" onClick={onExport} style={{ alignSelf: "flex-end" }}>
          Exportar Excel
        </Button>
      </div>
    </div>
  );
}
