import type { ReactNode, HTMLAttributes, ElementType } from "react";

export interface GlassCardProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  /** normal: 24 px (16 en celular). compact: 16 px. none: para una tabla con su cabecera. */
  padding?: "normal" | "compact" | "none";
  /** Toda la carta responde al puntero (tarjeta de producto). */
  interactive?: boolean;
  as?: ElementType;
}

/**
 * Carta del sistema (`.carta`): superficie opaca para un objeto (panel de cobro, tabla,
 * ficha, producto). El nombre quedó de la etapa de vidrio; ya no lleva desenfoque:
 * sólo la cabecera y el modal lo tienen.
 */
export function GlassCard({
  children,
  padding = "normal",
  interactive = false,
  as: Component = "div",
  className,
  style,
  ...rest
}: GlassCardProps) {
  const classes = [
    "carta",
    padding === "none" ? "carta--sin-relleno" : "",
    interactive ? "carta--interactiva" : "",
    className
  ].filter(Boolean).join(" ");
  return (
    <Component
      className={classes}
      style={padding === "compact" ? { padding: "var(--esp-m)", ...style } : style}
      {...rest}
    >
      {children}
    </Component>
  );
}
