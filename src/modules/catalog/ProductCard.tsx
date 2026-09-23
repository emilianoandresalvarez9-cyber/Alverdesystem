import type { ReactNode } from "react";
import { GlassCard, Badge, Tag } from "../../shared/ui";
import type { CatalogProduct } from "./types";

interface ProductCardProps {
  product: CatalogProduct;
  /** Al tocar la tarjeta se expande y muestra `actions` (un botón no puede ir dentro de otro). */
  onToggle?: () => void;
  expanded?: boolean;
  actions?: ReactNode;
}

const BASE_UNIT_LABEL: Record<string, string> = {
  gram: "gramos",
  millilitre: "ml",
  unit: "unidad",
};

export function ProductCard({ product, onToggle, expanded = false, actions }: ProductCardProps) {
  const lowestPrice = product.presentations
    .filter(p => p.active)
    .map(p => p.sale_price)
    .filter(p => p > 0)
    .sort((a, b) => a - b)[0];

  return (
    <GlassCard as="article" className="product-card">
      <button type="button" className="product-card__toggle" onClick={onToggle} aria-expanded={onToggle ? expanded : undefined} disabled={!onToggle}>
      <span className="product-card__header">
        <span className="product-card__name">{product.name}</span>
        {lowestPrice != null && (
          <span className="product-card__price">
            desde <strong>${lowestPrice.toLocaleString("es-AR")}</strong>
          </span>
        )}
      </span>

      <span className="product-card__meta">
        {product.brand && (
          <Badge tone="neutro">{product.brand.name}</Badge>
        )}
        {product.category && (
          <Badge tone="neutro" style={{ opacity: 0.75 }}>{product.category.name}</Badge>
        )}
        <Badge tone="neutro" style={{ opacity: 0.55 }}>{BASE_UNIT_LABEL[product.base_unit] ?? product.base_unit}</Badge>
      </span>

      {product.labels.length > 0 && (
        <span className="product-card__labels">
          {product.labels.map(l => (
            <Tag key={l.id}>{l.name}</Tag>
          ))}
        </span>
      )}

      {product.presentations.filter(p => p.active).length > 0 && (
        <span className="product-card__presentations">
          {product.presentations.filter(p => p.active).map(pr => (
            <span key={pr.id} className="product-card__presentation">
              {pr.name} — ${pr.sale_price.toLocaleString("es-AR")}
            </span>
          ))}
        </span>
      )}
      </button>
      {expanded && actions ? <div className="product-card__actions">{actions}</div> : null}
    </GlassCard>
  );
}
