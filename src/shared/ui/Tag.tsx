import type { ButtonHTMLAttributes } from "react";

export type TagProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Estado del filtro conmutable (RF-02/RF-04: etiquetas combinables). */
  active?: boolean;
};

/**
 * Chip conmutable para filtros de marca, rubro y etiqueta del catálogo.
 * Es un <button> con aria-pressed, así funciona con teclado y lector
 * de pantalla sin trabajo extra.
 */
export function Tag({ active = false, className, children, ...rest }: TagProps) {
  const classes = ["tag", active ? "tag-activo" : "", className].filter(Boolean).join(" ");
  return (
    <button type="button" aria-pressed={active} {...rest} className={classes}>
      {children}
    </button>
  );
}
