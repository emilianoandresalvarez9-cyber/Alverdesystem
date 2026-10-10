import { useId, forwardRef } from "react";
import type { InputHTMLAttributes, ForwardedRef } from "react";
import { Icon, type IconName } from "./Icon";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Texto visible del campo. Obligatorio: ningún input sin etiqueta. */
  label: string;
  /** Ayuda breve mostrada bajo el campo. */
  help?: string;
  /** Mensaje de error; al estar presente marca el campo como inválido. */
  error?: string;
  /** Ícono dentro del campo, a la izquierda (barcode_scanner en el campo del lector, search en buscadores). */
  icon?: IconName;
  /** Unidad a la derecha: g, kg, %, días. */
  suffix?: string;
  /** Importes, pesos, porcentajes: alineado a la derecha. */
  numeric?: boolean;
};

/**
 * Campo del sistema: etiqueta arriba, entrada de 44 px, ayuda o error abajo.
 * `className` va al contenedor `.campo`.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, help, error, icon, suffix, numeric, id, className, ...rest },
  ref: ForwardedRef<HTMLInputElement>
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descriptionId = `${inputId}-desc`;
  const described = Boolean(help) || Boolean(error);
  return (
    <div className={["campo", error ? "campo--error" : "", className].filter(Boolean).join(" ")}>
      <label className="campo__etiqueta" htmlFor={inputId}>{label}</label>
      <div className={numeric ? "entrada entrada--cifra" : "entrada"}>
        {icon ? <Icon name={icon} /> : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={described ? descriptionId : undefined}
          {...rest}
        />
        {suffix ? <span className="entrada__sufijo">{suffix}</span> : null}
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
});
