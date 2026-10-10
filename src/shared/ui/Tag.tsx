import type { ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";

export type TagProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Estado del filtro conmutable (RF-02/RF-04: etiquetas combinables). */
  active?: boolean;
};

/**
 * Chip de filtro: un <button> con aria-pressed, así funciona con teclado y lector de
 * pantalla. Elegido muestra tilde, no sólo color.
 */
export function Tag({ active = false, className, children, type = "button", ...rest }: TagProps) {
  return (
    <button {...rest} type={type} aria-pressed={active} className={["chip", className].filter(Boolean).join(" ")}>
      <Icon name="check" size="s" />
      {children}
    </button>
  );
}
