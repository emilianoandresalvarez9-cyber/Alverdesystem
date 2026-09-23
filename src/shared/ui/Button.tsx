import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primario" | "secundario" | "fantasma" | "peligro";

const classByVariant: Record<ButtonVariant, string> = {
  primario: "button",
  secundario: "button button-secondary",
  fantasma: "button button-ghost",
  peligro: "button button-danger"
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Variante visual. Por defecto, la acción principal (lima). */
  variant?: ButtonVariant;
  /** Deshabilita el botón y avisa a lectores de pantalla que hay trabajo en curso. */
  loading?: boolean;
};

export function Button({
  variant = "primario",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [classByVariant[variant], className].filter(Boolean).join(" ");

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {children}
    </button>
  );
}
