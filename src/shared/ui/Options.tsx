import { useId } from "react";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type OptionItem<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: IconName;
  disabled?: boolean;
};

export type OptionsProps<T extends string> = {
  /** Nombre del grupo de radios (único en la página). */
  name: string;
  /** Qué se elige. Si `showLegend` es false queda sólo para lectores de pantalla. */
  legend: string;
  showLegend?: boolean;
  value: T | null;
  onChange: (value: T) => void;
  options: OptionItem<T>[];
  /**
   * mosaico: medio de pago (56 px, dos columnas). segmento: rango, movimiento de cuenta.
   * lista: motivos, una por fila. tres: tres columnas.
   */
  variant?: "mosaico" | "segmento" | "lista" | "tres";
  className?: string;
};

const VARIANT_CLASS = { mosaico: "", segmento: "opciones--segmento", lista: "opciones--lista", tres: "opciones--tres" };

/**
 * Una sola elección entre pocas opciones a la vista (radios con forma de mosaico o de
 * segmento). La elegida lleva tilde o fondo de carta: no depende sólo del color.
 */
export function Options<T extends string>({
  name, legend, showLegend = false, value, onChange, options, variant = "mosaico", className
}: OptionsProps<T>) {
  const legendId = useId();
  const group = (
    <div
      className={["opciones", VARIANT_CLASS[variant], showLegend ? "" : className].filter(Boolean).join(" ")}
      role="radiogroup"
      aria-label={showLegend ? undefined : legend}
      aria-labelledby={showLegend ? legendId : undefined}
    >
      {options.map((option) => (
        <label key={option.value} className="opcion">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
          />
          {option.icon ? <Icon name={option.icon} /> : null}
          <span>{option.label}</span>
          {variant === "segmento" ? null : <Icon name="check" className="opcion__check" />}
        </label>
      ))}
    </div>
  );
  if (!showLegend) return group;
  return (
    <div className={["campo", className].filter(Boolean).join(" ")}>
      <p className="campo__etiqueta" id={legendId}>{legend}</p>
      {group}
    </div>
  );
}
