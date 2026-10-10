import { useId } from "react";
import type { SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Texto visible del campo. Obligatorio: ningún select sin etiqueta. */
  label: string;
  /** Ayuda breve mostrada bajo el campo. */
  help?: string;
  /** Mensaje de error; al estar presente marca el campo como inválido. */
  error?: string;
};

/**
 * Select nativo con flecha propia, 44 px. Se usa con más de cuatro opciones o cuando la
 * lista crece con los datos. `className` va al contenedor `.campo`.
 */
export function SelectField({ label, help, error, id, className, children, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const descriptionId = `${selectId}-desc`;
  const described = Boolean(help) || Boolean(error);
  return (
    <div className={["campo", error ? "campo--error" : "", className].filter(Boolean).join(" ")}>
      <label className="campo__etiqueta" htmlFor={selectId}>{label}</label>
      <div className="selector">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={described ? descriptionId : undefined}
          {...rest}
        >
          {children}
        </select>
        <Icon name="keyboard_arrow_down" />
      </div>
      {error ? (
        <p id={descriptionId} className="campo__ayuda" role="alert">
          <Icon name="error" size="s" />
          {error}
        </p>
      ) : help ? (
        <p id={descriptionId} className="campo__ayuda">{help}</p>
      ) : null}
    </div>
  );
}
