import type { HTMLAttributes } from "react";

export type BadgeTone = "neutro" | "exito" | "aviso" | "error";

const classByTone: Record<BadgeTone, string> = {
  neutro: "badge",
  exito: "badge badge-exito",
  aviso: "badge badge-aviso",
  error: "badge badge-error"
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  /** Tono semántico: neutro (gris), exito (lima), aviso (ámbar), error (rojo). */
  tone?: BadgeTone;
};

export function Badge({ tone = "neutro", className, children, ...rest }: BadgeProps) {
  const classes = [classByTone[tone], className].filter(Boolean).join(" ");
  return (
    <span {...rest} className={classes}>
      {children}
    </span>
  );
}
