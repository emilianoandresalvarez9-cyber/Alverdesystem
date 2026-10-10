import { useRef, useCallback } from "react";
import { TextField, Button, Tag } from "../../shared/ui";
import type { Brand, Category, Label, CatalogFilters } from "./types";
import { useBranch } from "../../shared/branch/BranchContext";

interface CatalogFiltersBarProps {
  filters: CatalogFilters;
  setFilters: (f: Partial<CatalogFilters>) => void;
  brands: Brand[];
  categories: Category[];
  labels: Label[];
  /** Recibe la sucursal de trabajo para exportar sus precios (RF-69). */
  onExport: (branchId: string | null) => void;
}

/**
 * RF-04: filtros por marca, rubro y etiqueta, combinables. Cada eje es una fila de
 * chips (un solo valor por eje, "Todas" lo limpia), como en las maquetas RNF-06.
 */
export function CatalogFiltersBar({
  filters, setFilters, brands, categories, labels, onExport,
}: CatalogFiltersBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const { workingBranchId } = useBranch();

  const clearAll = useCallback(() => {
    setFilters({ search: "", brandId: "", categoryId: "", labelId: "" });
    searchRef.current?.focus();
  }, [setFilters]);

  const hasActiveFilters = filters.search || filters.brandId || filters.categoryId || filters.labelId;

  return (
    <div className="catalog-filters glass">
      <div className="catalog-filters__top">
        <TextField
          ref={searchRef}
          label=""
          placeholder="Buscar por nombre o código de barras…"
          value={filters.search}
          onChange={e => setFilters({ search: e.target.value })}
          className="catalog-filters__search"
          aria-label="Buscar producto"
        />
        {hasActiveFilters && (
          <Button variant="fantasma" onClick={clearAll}>Limpiar filtros</Button>
        )}
        <Button variant="secundario" onClick={() => onExport(workingBranchId)}>Exportar Excel</Button>
      </div>
      <FilterAxis label="Marca" all="Todas" items={brands} value={filters.brandId} onChange={brandId => setFilters({ brandId })} />
      <FilterAxis label="Rubro" all="Todos" items={categories} value={filters.categoryId} onChange={categoryId => setFilters({ categoryId })} />
      <FilterAxis label="Etiqueta" all="Todas" items={labels} value={filters.labelId} onChange={labelId => setFilters({ labelId })} />
    </div>
  );
}

function FilterAxis({ label, all, items, value, onChange }: {
  label: string; all: string; items: { id: string; name: string }[]; value: string; onChange: (id: string) => void;
}) {
  return (
    <div className="catalog-axis" role="group" aria-label={label}>
      <span className="catalog-axis__label">{label}</span>
      <div className="catalog-axis__chips">
        <Tag active={value === ""} onClick={() => onChange("")}>{all}</Tag>
        {items.map(item => (
          <Tag key={item.id} active={value === item.id} onClick={() => onChange(value === item.id ? "" : item.id)}>{item.name}</Tag>
        ))}
      </div>
    </div>
  );
}
