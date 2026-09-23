import { useState } from "react";
import { useCatalog, filterProducts } from "../modules/catalog/useCatalog";
import { ProductCard } from "../modules/catalog/ProductCard";
import { CatalogFiltersBar } from "../modules/catalog/CatalogFiltersBar";
import { exportCatalogToExcel } from "../modules/catalog/exportCatalog";
import { EmptyState, GlassCard } from "../shared/ui";
import { AppShell } from "../shared/components/AppShell";
import { MissingReportButton } from "../modules/catalog/MissingReportButton";

export function CatalogPage() {
  const { products, brands, categories, labels, filters, setFilters, isOffline, isLoading, error } = useCatalog();
  const [selected, setSelected] = useState<string | null>(null);

  const visible = filterProducts(products, filters);

  return (
    <AppShell active="catalog" title="Catálogo">
      <div className="catalog-page">
        <header className="page-heading">
          <h1>Catálogo</h1>
          {isOffline && (
            <span className="sync-status offline">
              <span>⚠️</span> Sin conexión — mostrando caché local
            </span>
          )}
        </header>

        <CatalogFiltersBar
          filters={filters}
          setFilters={setFilters}
          brands={brands}
          categories={categories}
          labels={labels}
          onExport={() => exportCatalogToExcel(visible)}
        />

        {isLoading && (
          <div className="catalog-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <GlassCard key={i} className="product-card skeleton" style={{ minHeight: 120 }} />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <GlassCard className="catalog-error">
            <p style={{ color: "var(--color-error)" }}>{error}</p>
          </GlassCard>
        )}

        {!isLoading && !error && visible.length === 0 && (
          <EmptyState title="Sin resultados">
            Probá cambiando los filtros o la búsqueda.
          </EmptyState>
        )}

        {!isLoading && visible.length > 0 && (
          <>
            <p className="catalog-count">
              {visible.length} {visible.length === 1 ? "producto" : "productos"}
              {visible.length < products.length && ` de ${products.length}`}
            </p>
            <div className="catalog-grid">
              {visible.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  expanded={p.id === selected}
                  onToggle={() => setSelected(p.id === selected ? null : p.id)}
                  actions={<MissingReportButton productId={p.id} productName={p.name} />}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
