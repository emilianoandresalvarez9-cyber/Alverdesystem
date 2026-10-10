import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primario" | "secundario" | "fantasma" | "peligro";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * primario: la acción que cierra la tarea (una sola por pantalla).
   * secundario: acciones frecuentes que no son el objetivo.
   * fantasma: Cancelar, Limpiar, Vaciar.
   * peligro: Archivar, Quitar; con `confirmar`, la acción que no se deshace dentro de su diálogo.
   */
  variant?: ButtonVariant;
  /** grande: sólo Cobrar (64 px). compacto: 36 px. icono: cuadrado, exige aria-label. */
  size?: "grande" | "compacto" | "icono";
  /** Ícono a la izquierda del texto. */
  icon?: IconName;
  /** Ancho completo. */
  block?: boolean;
  /** Peligro relleno: sólo para confirmar lo que no se puede deshacer. */
  confirmar?: boolean;
  /** Deshabilita el botón y avisa a lectores de pantalla que hay trabajo en curso. */
  loading?: boolean;
};

export function buttonClasses({ variant = "primario", size, block, confirmar, className }:
  Pick<ButtonProps, "variant" | "size" | "block" | "confirmar" | "className">): string {
  return [
    "boton",
    `boton--${variant}`,
    size ? `boton--${size}` : "",
    block ? "boton--bloque" : "",
    confirmar && variant === "peligro" ? "boton--confirmar" : "",
    className
  ].filter(Boolean).join(" ");
}

export function Button({
  variant = "primario",
  size,
  icon,
  block,
  confirmar,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={buttonClasses({ variant, size, block, confirmar, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {icon ? <Icon name={icon} size={size === "compacto" ? "s" : size === "grande" ? "l" : undefined} /> : null}
      {children}
    </button>
  );
}
