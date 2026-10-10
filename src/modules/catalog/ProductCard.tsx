import type { ReactNode } from "react";
import { Badge, Icon } from "../../shared/ui";
import type { CatalogProduct } from "./types";
import { effectivePrice } from "./branchPricing";
import { pricePerKiloFromGram } from "./scalePricing";
import { useBranch } from "../../shared/branch/BranchContext";
import { formatMoney } from "../pos/money";

interface ProductCardProps {
  product: CatalogProduct;
  /** Al tocar la tarjeta se abre o se cierra (una abierta a la vez, la maneja la página). */
  onToggle?: () => void;
  expanded?: boolean;
  /** Acciones al pie de la tarjeta abierta (Avisar que falta). */
  actions?: ReactNode;
}

/**
 * Tarjeta de producto que se expande (`details.carta.producto`). Cerrada: nombre, «desde $X»,
 * marca · rubro y etiquetas. Abierta: las presentaciones con el precio de la sucursal
 * (RF-69; con «Todas», el base) y las acciones. Nunca costos ni márgenes (RNF-04).
 */
export function ProductCard({ product, onToggle, expanded = false, actions }: ProductCardProps) {
  const { workingBranchId } = useBranch();
  const active = product.presentations.filter((p) => p.active);
  const lowestPrice = active
    .filter((p) => !p.sold_by_weight)
    .map((p) => effectivePrice(p, workingBranchId))
    .filter((p) => p > 0)
    .sort((a, b) => a - b)[0];
  const meta = [product.brand?.name, product.category?.name].filter(Boolean).join(" · ");

  return (
    <details className="carta carta--interactiva producto" open={expanded}>
      <summary onClick={(event) => { event.preventDefault(); onToggle?.(); }}>
        <span className="producto__cabeza">
          <span className="titulo-seccion">{product.name}</span>
          <Icon name="keyboard_arrow_down" />
        </span>
        {lowestPrice != null && (
          <span className="producto__desde">desde <span className="precio">{formatMoney(lowestPrice)}</span></span>
        )}
        {meta && <span className="cuerpo-s suave">{meta}</span>}
        {product.labels.length > 0 && (
          <span className="producto__etiquetas">
            {product.labels.map((l) => <Badge key={l.id} tone="etiqueta">{l.name}</Badge>)}
          </span>
        )}
      </summary>
      {active.length > 0 && (
        <ul className="presentaciones" aria-label="Presentaciones y precios de la sucursal">
          {active.map((pr) => {
            const price = effectivePrice(pr, workingBranchId);
            return (
              <li key={pr.id}>
                <span>{pr.name}</span>
                {pr.sold_by_weight
                  // Balanza (ADR-001): el precio se guarda por gramo y se muestra por kilo.
                  ? <span className="precio">{formatMoney(pricePerKiloFromGram(price))} <small>/kg</small></span>
                  : <span className="precio">{formatMoney(price)}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {expanded && actions ? <div className="producto__pie">{actions}</div> : null}
    </details>
  );
}
