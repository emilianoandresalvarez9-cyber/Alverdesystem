import { Badge } from "../../shared/ui";
import type { LotExpiryStatus } from "./types";

interface LotStatusBadgeProps {
  status: LotExpiryStatus;
  daysUntilExpiry: number | null;
}

const days = (n: number) => (n === 1 ? "1 día" : `${n} días`);

/**
 * Severidad en forma, no sólo en color: los cuatro valores del filtro de vencimiento, cada
 * uno con su ícono, y sólo «Vencido» relleno. La fecha va al lado, en la celda.
 */
export function LotStatusBadge({ status, daysUntilExpiry }: LotStatusBadgeProps) {
  if (status === "expired") return <Badge tone="critico">Vencido</Badge>;
  if (status === "critical") {
    return <Badge tone="aviso">{daysUntilExpiry != null && daysUntilExpiry > 0 ? `Crítico · ${days(daysUntilExpiry)}` : "Vence hoy"}</Badge>;
  }
  if (status === "warning") return <Badge tone="neutro" icon="schedule">Por vencer · {days(daysUntilExpiry ?? 0)}</Badge>;
  if (status === "good") return <Badge tone="exito">En regla</Badge>;
  return <Badge tone="neutro">Sin vencimiento</Badge>;
}
