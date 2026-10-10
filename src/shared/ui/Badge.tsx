import type { HTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * neutro: Cerrado, Archivado, rol. exito: En regla, Turno abierto. aviso: Crítico, Pendiente.
 * error: Supera el tope. critico: Vencido (el único relleno). etiqueta: atributos (Sin TACC).
 */
export type BadgeTone = "neutro" | "exito" | "aviso" | "error" | "critico" | "etiqueta";

/** Ningún estado depende sólo del color: cada tono trae su ícono salvo neutro y etiqueta. */
const DEFAULT_ICON: Partial<Record<BadgeTone, IconName>> = {
  exito: "check_circle",
  aviso: "warning",
  error: "error",
  critico: "block"
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  /** Ícono propio (candado, sync…). `null` lo quita. */
  icon?: IconName | null;
};

export function Badge({ tone = "neutro", icon, className, children, ...rest }: BadgeProps) {
  const name = icon === null ? undefined : icon ?? DEFAULT_ICON[tone];
  return (
    <span {...rest} className={["estado", `estado--${tone}`, className].filter(Boolean).join(" ")}>
      {name ? <Icon name={name} size="s" /> : null}
      {children}
    </span>
  );
}
