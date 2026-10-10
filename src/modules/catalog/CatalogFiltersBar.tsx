import { useRef, useCallback } from "react";
import { TextField, Button, SelectField, Tag, useCompact } from "../../shared/ui";
import type { Brand, Category, Label, CatalogFilters } from "./types";
import { useBranch } from "../../shared/branch/BranchContext";

interface CatalogFiltersBarProps {
  filters: CatalogFilters;
  setFilters: (f: Partial<CatalogFilters>) => void;
  brands: Brand[];
  categories: Category[];
  labels: Label[];
  /** «4 de 6 productos»: cuántos quedan con los filtros. */
  countText: string;
  /** Recibe la sucursal de trabajo para exportar sus precios (RF-69). */
  onExport: (branchId: string | null) => void;
}

/**
 * RF-04: filtros por marca, rubro y etiqueta, combinables. Marca y Rubro son selects
 * (crecen con los datos y una fila de 20 chips no entra); Etiqueta sigue en chips porque
 * son pocas y se combinan. Un solo valor por eje: «Todas» / «Todos» lo limpia.
 */
export function CatalogFiltersBar({
  filters, setFilters, brands, categories, labels, countText, onExport,
}: CatalogFiltersBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const { workingBranchId } = useBranch();
  const compact = useCompact();

  const clearAll = useCallback(() => {
    setFilters({ search: "", brandId: "", categoryId: "", labelId: "" });
    searchRef.current?.focus();
  }, [setFilters]);

  const hasActiveFilters = Boolean(filters.search || filters.brandId || filters.categoryId || filters.labelId);
  const exportExcel = () => onExport(workingBranchId);

  return (
    <>
      <div className="catalogo-barra">
        <TextField
          ref={searchRef}
          type="search"
          label="Buscar en el catálogo"
          hideLabel
          icon="search"
          placeholder="Buscá por nombre, marca o código"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
        />
        <SelectField inline label="Marca" value={filters.brandId} onChange={(e) => setFilters({ brandId: e.target.value })}>
          <option value="">Todas</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </SelectField>
        <SelectField inline label="Rubro" value={filters.categoryId} onChange={(e) => setFilters({ categoryId: e.target.value })}>
          <option value="">Todos</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        {!compact && <Button variant="secundario" icon="download" onClick={exportExcel}>Exportar Excel</Button>}
      </div>

      <div className="filtros">
        <div className="fila catalogo-etiquetas">
          {!compact && <span className="cuerpo-s suave">Etiqueta</span>}
          <div className="chips" role="group" aria-label="Etiqueta">
            <Tag active={filters.labelId === ""} onClick={() => setFilters({ labelId: "" })}>Todas</Tag>
            {labels.map((l) => (
              <Tag key={l.id} active={filters.labelId === l.id} onClick={() => setFilters({ labelId: filters.labelId === l.id ? "" : l.id })}>
                {l.name}
              </Tag>
            ))}
          </div>
        </div>
        <div className="fila">
          <span className="meta" role="status">{countText}</span>
          <Button variant="fantasma" size="compacto" onClick={clearAll} disabled={!hasActiveFilters}>Limpiar filtros</Button>
          {compact && <Button variant="fantasma" size="compacto" icon="download" onClick={exportExcel}>Excel</Button>}
        </div>
      </div>
    </>
  );
}
