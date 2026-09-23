import { useEffect, useId, useRef } from "react";
import type { PropsWithChildren, ReactNode } from "react";

export type ModalProps = PropsWithChildren<{
  /** El modal se abre y cierra desde el estado del padre. */
  open: boolean;
  title: string;
  /** Llamado al cerrar con el botón, con Escape o al cerrarse el diálogo. */
  onClose: () => void;
  /** Pie opcional para las acciones (Cancelar / Confirmar). */
  footer?: ReactNode;
}>;

/**
 * Modal sobre el elemento nativo <dialog> (showModal), que ya resuelve
 * foco atrapado, Escape y capa de fondo sin dependencias externas.
 */
export function Modal({ open, title, onClose, footer, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="modal glass" aria-labelledby={titleId} onClose={onClose}>
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="button button-ghost" onClick={onClose} aria-label="Cerrar">
          &times;
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer ? <div className="modal-foot">{footer}</div> : null}
    </dialog>
  );
}
