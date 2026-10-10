import { useEffect, useId, useRef } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { Icon } from "./Icon";

export type ModalProps = PropsWithChildren<{
  /** El modal se abre y cierra desde el estado del padre. */
  open: boolean;
  /** Qué se hace y sobre qué: «Peso de Nuez mariposa», «¿Anular la venta C1-1288?». */
  title: string;
  /** Bajada opcional bajo el título. */
  subtitle?: ReactNode;
  /** Llamado al cerrar con el botón, con Escape o al cerrarse el diálogo. */
  onClose: () => void;
  /** Pie opcional para las acciones (Cancelar / Confirmar). */
  footer?: ReactNode;
  /** 720 px en vez de 480: para diálogos con una tabla. */
  wide?: boolean;
}>;

/**
 * Modal sobre el elemento nativo <dialog> (showModal), que ya resuelve foco atrapado,
 * Escape y capa de fondo sin dependencias externas. En celular sube como hoja.
 */
export function Modal({ open, title, subtitle, onClose, footer, wide, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={wide ? "modal modal--ancho" : "modal"} aria-labelledby={titleId} onClose={onClose}>
      <div className="modal__cabecera">
        <div className="pila pila--s">
          <h2 id={titleId} className="titulo-modal">{title}</h2>
          {subtitle ? <p className="cuerpo-s suave">{subtitle}</p> : null}
        </div>
        <button type="button" className="boton boton--fantasma boton--icono" onClick={onClose} aria-label="Cerrar">
          <Icon name="close" />
        </button>
      </div>
      <div className="modal__cuerpo">{children}</div>
      {footer ? <div className="modal__pie">{footer}</div> : null}
    </dialog>
  );
}
