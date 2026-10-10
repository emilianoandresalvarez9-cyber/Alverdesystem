import type { PropsWithChildren } from "react";
import { Icon, type IconName } from "./Icon";

export type MessageTone = "neutro" | "exito" | "aviso" | "error";

const ICON: Record<MessageTone, IconName> = { neutro: "info", exito: "check_circle", aviso: "warning", error: "error" };

/**
 * Mensaje de resultado o aviso (`.mensaje`): ícono + frase que dice qué pasó y cómo seguir.
 * Los errores se anuncian de inmediato (role="alert"); el resto, con role="status".
 */
export function Message({ tone = "neutro", className, children }: PropsWithChildren<{ tone?: MessageTone; className?: string }>) {
  return (
    <div
      className={["mensaje", tone === "neutro" ? "" : `mensaje--${tone}`, className].filter(Boolean).join(" ")}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon name={ICON[tone]} />
      <span>{children}</span>
    </div>
  );
}
