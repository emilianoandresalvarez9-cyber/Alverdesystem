import { useState } from "react";
import { useCatalog, filterProducts } from "../modules/catalog/useCatalog";
import { ProductCard } from "../modules/catalog/ProductCard";
import { CatalogFiltersBar } from "../modules/catalog/CatalogFiltersBar";
import { exportCatalogToExcel } from "../modules/catalog/exportCatalog";
import { EmptyState, Message } from "../shared/ui";
import { AppShell } from "../shared/components/AppShell";
import { MissingReportButton } from "../modules/catalog/MissingReportButton";

export function CatalogPage() {
  const { products, brands, categories, labels, filters, setFilters, isOffline, isLoading, error } = useCatalog();
  const [selected, setSelected] = useState<string | null>(null);

  const visible = filterProducts(products, filters);

  const countText = `${visible.length} ${visible.length === 1 ? "producto" : "productos"}${visible.length < products.length ? ` de ${products.length}` : ""}`;

  return (
    <AppShell active="catalog" title="Catálogo">
      {isOffline && <Message tone="aviso">Sin conexión: se muestra el catálogo guardado en este equipo.</Message>}

      <CatalogFiltersBar
        filters={filters}
        setFilters={setFilters}
        brands={brands}
        categories={categories}
        labels={labels}
        countText={isLoading ? "" : countText}
        onExport={(branchId) => exportCatalogToExcel(visible, "catalogo-alverde", branchId)}
      />

      {isLoading && (
        <div className="productos" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="carta pila pila--s">
              <span className="esqueleto" style={{ width: "70%" }} />
              <span className="esqueleto" style={{ width: "40%" }} />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && <Message tone="error">{error}</Message>}

      {!isLoading && !error && visible.length === 0 && (
        <EmptyState title="Sin resultados" icon="search">Probá cambiando los filtros o la búsqueda.</EmptyState>
      )}

      {!isLoading && visible.length > 0 && (
        <div className="productos">
          {visible.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              expanded={p.id === selected}
              onToggle={() => setSelected(p.id === selected ? null : p.id)}
              actions={<MissingReportButton productId={p.id} productName={p.name} />}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
