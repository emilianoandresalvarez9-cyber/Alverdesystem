import type { PropsWithChildren, ReactNode } from "react";

export type EmptyStateProps = PropsWithChildren<{
  /** Título corto, ej. "Sin resultados". */
  title: string;
  /** Acción opcional (normalmente un <Button>). */
  action?: ReactNode;
}>;

/**
 * Estado vacío estándar para listados: búsquedas sin resultados,
 * secciones todavía sin datos, errores recuperables.
 */
export function EmptyState({ title, action, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}
