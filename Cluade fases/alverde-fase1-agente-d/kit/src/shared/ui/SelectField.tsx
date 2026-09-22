import { useId } from "react";
import type { SelectHTMLAttributes } from "react";

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Texto visible del campo. Obligatorio: ningún select sin etiqueta. */
  label: string;
  /** Ayuda breve mostrada bajo el campo. */
  help?: string;
  /** Mensaje de error; al estar presente marca el campo como inválido. */
  error?: string;
};

export function SelectField({ label, help, error, id, className, children, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const descriptionId = `${selectId}-desc`;
  const described = Boolean(help) || Boolean(error);
  return (
    <label htmlFor={selectId} className={className}>
      {label}
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={described ? descriptionId : undefined}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <span id={descriptionId} className="field-error" role="alert">
          {error}
        </span>
      ) : help ? (
        <span id={descriptionId} className="field-help">
          {help}
        </span>
      ) : null}
    </label>
  );
}
