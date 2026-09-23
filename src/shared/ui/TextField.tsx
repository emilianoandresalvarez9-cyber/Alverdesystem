import { useId } from "react";
import type { InputHTMLAttributes } from "react";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Texto visible del campo. Obligatorio: ningún input sin etiqueta. */
  label: string;
  /** Ayuda breve mostrada bajo el campo. */
  help?: string;
  /** Mensaje de error; al estar presente marca el campo como inválido. */
  error?: string;
};

export function TextField({ label, help, error, id, className, ...rest }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descriptionId = `${inputId}-desc`;
  const described = Boolean(help) || Boolean(error);
  return (
    <label htmlFor={inputId} className={className}>
      {label}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={described ? descriptionId : undefined}
        {...rest}
      />
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
