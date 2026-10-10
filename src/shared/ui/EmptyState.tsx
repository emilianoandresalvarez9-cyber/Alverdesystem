import type { PropsWithChildren, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type EmptyStateProps = PropsWithChildren<{
  /** Frase corta en negrita: «Sin resultados», «Todavía no hay clientes». */
  title: string;
  /** Acción opcional (normalmente un <Button>). */
  action?: ReactNode;
  icon?: IconName;
}>;

/**
 * Lista vacía: ícono, una frase en negrita y qué va a aparecer ahí.
 */
export function EmptyState({ title, action, icon = "inbox", children }: EmptyStateProps) {
  return (
    <div className="vacio">
      <Icon name={icon} />
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}
