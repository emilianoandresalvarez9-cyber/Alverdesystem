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
        onChange={e => setFilters({ search: e.target.value })}
        className="catalog-filters__search"
        aria-label="Buscar producto"
      />
      <div className="catalog-filters__row">
        <SelectField
          label="Marca"
          value={filters.brandId}
          onChange={e => setFilters({ brandId: e.target.value })}
        >
          <option value="">Todas las marcas</option>
          {brands.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </SelectField>
        <SelectField
          label="Rubro"
          value={filters.categoryId}
          onChange={e => setFilters({ categoryId: e.target.value })}
        >
          <option value="">Todos los rubros</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </SelectField>
        <SelectField
          label="Etiqueta"
          value={filters.labelId}
          onChange={e => setFilters({ labelId: e.target.value })}
        >
          <option value="">Todas las etiquetas</option>
          {labels.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </SelectField>
        {hasActiveFilters && (
          <Button variant="fantasma" onClick={clearAll} style={{ alignSelf: "flex-end" }}>
            Limpiar filtros
          </Button>
        )}
        <Button variant="secundario" onClick={onExport} style={{ alignSelf: "flex-end" }}>
          Exportar Excel
        </Button>
      </div>
    </div>
  );
}
