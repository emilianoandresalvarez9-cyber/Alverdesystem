import type { HTMLAttributes } from "react";

export type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * `true` usa la superficie barata sin desenfoque (.glass-lite).
   * Usarla SIEMPRE en elementos repetidos (filas de listas, grillas de
   * productos): el blur real es caro en la notebook de la caja.
   */
  lite?: boolean;
  /** `false` quita el padding interno (para tablas a borde completo). */
  padded?: boolean;
};

export function GlassCard({ lite = false, padded = true, className, children, ...rest }: GlassCardProps) {
  const classes = [lite ? "glass-lite" : "glass", "card", padded ? "" : "card-flush", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div {...rest} className={classes}>
      {children}
    </div>
  );
}
