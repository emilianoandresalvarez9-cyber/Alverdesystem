import { useState } from "react";
import { Badge, EmptyState, Icon, Message, SelectField, TextField } from "../shared/ui";
import { ThemeToggle } from "../shared/theme/ThemeToggle";
import { usePriceList } from "../modules/storefront/usePriceList";
import { HeroScene } from "../modules/storefront/HeroScene";
import { SproutMark } from "../modules/storefront/SproutMark";
import {
  EMPTY_PRICE_FILTERS,
  availabilityBadge,
  categoriesOf,
  countText,
  filterProducts,
  priceText,
  updatedLabel,
  type PriceListFilters,
  type PublicProduct
} from "../modules/storefront/priceList";

/** Cuántas tarjetas entran escalonadas en la primera carga; el resto aparece junto. */
const STAGGERED_CARDS = 12;

/**
 * Sitio público de la dietética: portada con la marca, la lista de precios con disponibilidad
 * en vivo y dónde estamos. No pide sesión y sólo muestra lo que la base publica (RNF-04).
 */
export function PublicPricesPage() {
  const { products, branches, branchId, setBranchId, isLoading, failed, updatedAt, now, changed } = usePriceList();
  const [filters, setFilters] = useState<PriceListFilters>(EMPTY_PRICE_FILTERS);

  const categories = categoriesOf(products);
  const visible = filterProducts(products, filters);
  const currentBranch = branches.find((b) => b.id === branchId) ?? branches[0];
  const located = branches.filter((b) => b.address);
  const live = updatedAt !== null && !failed;

  return (
    <div className="sitio">
      <header className="sitio__cabecera">
        <div className="sitio__ancho sitio__barra">
          <a className="sitio__marca" href="/precios.html" aria-label="Alverde, dietética natural">
            <SproutMark size={36} />
            <span className="sitio__nombre">alverde</span>
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="sitio__contenido">
        <section className="sitio__ancho" aria-labelledby="sitio-titulo">
          <div className="portada">
            <div className="portada__texto">
              <h1 className="portada__titulo" id="sitio-titulo">Comer rico y sano, todos los días.</h1>
              <p className="portada__bajada">
                Somos una dietética natural. Acá ves qué hay hoy en el local y a cuánto está: la lista
                sale de nuestra caja y se actualiza sola.
              </p>
              <a className="portada__accion" href="#precios">Ver la lista de precios</a>
            </div>
            <HeroScene />
          </div>
        </section>

        <section className="sitio__ancho sitio__seccion" id="precios" aria-labelledby="precios-titulo">
          <div className="sitio__encabezado">
            <h2 className="sitio__subtitulo" id="precios-titulo">Lista de precios</h2>
            <p className="sitio__estado" role="status">
              <span className={live ? "sitio__vivo" : "sitio__vivo sitio__vivo--sin"} aria-hidden="true" />
              {updatedAt === null
                ? (failed ? "Sin conexión con el local" : "Cargando precios…")
                : `${updatedLabel(updatedAt, now)}${currentBranch && branches.length > 1 ? `, sucursal ${currentBranch.name}` : ""}`}
            </p>
          </div>

          {failed && updatedAt !== null && (
            <Message tone="aviso">No pudimos actualizar la lista. Mostramos la última que llegó; se vuelve a intentar sola.</Message>
          )}

          <div className="sitio__filtros">
            <TextField
              label="Buscar un producto"
              hideLabel
              icon="search"
              type="search"
              placeholder="Buscar por producto, marca o rubro"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            />
            {branches.length > 1 && (
              <SelectField
                label="Sucursal"
                inline
                value={currentBranch?.id ?? ""}
                onChange={(event) => setBranchId(event.target.value)}
              >
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectField>
            )}
          </div>

          <div className="chips chips--deslizable" role="group" aria-label="Filtrar la lista">
            <button type="button" className="chip" aria-pressed={filters.onlyAvailable}
              onClick={() => setFilters({ ...filters, onlyAvailable: !filters.onlyAvailable })}>
              <Icon name="check" size="s" />Sólo con stock
            </button>
            {categories.map((category) => (
              <button key={category} type="button" className="chip" aria-pressed={filters.category === category}
                onClick={() => setFilters({ ...filters, category: filters.category === category ? "" : category })}>
                <Icon name="check" size="s" />{category}
              </button>
            ))}
          </div>

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

          {!isLoading && failed && updatedAt === null && (
            <Message tone="error">No pudimos traer la lista de precios. Revisá tu conexión; la página vuelve a intentar sola.</Message>
          )}

          {!isLoading && updatedAt !== null && products.length === 0 && (
            <EmptyState title="Todavía no hay productos publicados" icon="storefront">
              Cuando el local cargue productos con precio, aparecen acá.
            </EmptyState>
          )}

          {!isLoading && products.length > 0 && visible.length === 0 && (
            <EmptyState title="Sin resultados" icon="search">Probá con otra palabra o quitá los filtros.</EmptyState>
          )}

          {!isLoading && visible.length > 0 && (
            <>
              <p className="meta">{countText(visible.length, products.length)}</p>
              <div className="productos">
                {visible.map((product, index) => (
                  <PriceCard key={product.id} product={product} changed={changed} order={Math.min(index, STAGGERED_CARDS)} />
                ))}
              </div>
            </>
          )}
        </section>

        {located.length > 0 && (
          <section className="sitio__ancho sitio__seccion" aria-labelledby="donde-titulo">
            <h2 className="sitio__subtitulo" id="donde-titulo">Dónde estamos</h2>
            <ul className="lista">
              {located.map((b) => (
                <li key={b.id}>
                  <Icon name="storefront" />
                  <span className="lista__principal">
                    <span className="lista__titulo">{b.name}</span>
                    <span className="lista__meta">{b.address}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="sitio__pie">
        <div className="sitio__ancho sitio__pie-fila">
          <div className="sitio__marca">
            <SproutMark size={28} />
            <span className="sitio__nombre">alverde</span>
          </div>
          <p>Los precios pueden cambiar sin aviso. La disponibilidad es orientativa: consultá en el local.</p>
          <a href="/">Ingreso del personal</a>
        </div>
      </footer>
    </div>
  );
}

function PriceCard({ product, changed, order }: { product: PublicProduct; changed: ReadonlySet<string>; order: number }) {
  return (
    <article className="carta producto sitio__producto" style={{ animationDelay: `${order * 40}ms` }}>
      <div className="pila pila--s">
        <h3 className="titulo-seccion">{product.name}</h3>
        {(product.brand || product.category) && (
          <p className="sitio__origen">
            {product.brand && <span>{product.brand}</span>}
            {product.category && <span>{product.category}</span>}
          </p>
        )}
      </div>
      <ul className="presentaciones" aria-label={`Presentaciones de ${product.name}`}>
        {product.presentations.map((presentation) => {
          const state = availabilityBadge(presentation);
          return (
            <li key={presentation.id} className={presentation.availability === "sin_stock" ? "apagada" : undefined}>
              <span className="sitio__presentacion-nombre">
                <span>{presentation.name}</span>
                <Badge tone={state.tone}>{state.text}</Badge>
              </span>
              <span className={changed.has(presentation.id) ? "precio sitio__precio--cambio" : "precio"}>{priceText(presentation)}</span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
