import { Badge } from "../../shared/ui";
import type { LotExpiryStatus } from "./types";

interface LotStatusBadgeProps {
  status: LotExpiryStatus;
  daysUntilExpiry: number | null;
  effectiveDate: string | null;
}

export function LotStatusBadge({ status, daysUntilExpiry, effectiveDate }: LotStatusBadgeProps) {
  if (status === "expired") {
    const daysAgo = daysUntilExpiry != null ? Math.abs(daysUntilExpiry) : 0;
    return (
      <Badge tone="error">
        Vencido {daysAgo > 0 ? `hace ${daysAgo}d` : "hoy"} ({effectiveDate})
      </Badge>
    );
  }

  if (status === "critical") {
    return (
      <Badge tone="error">
        ⚠️ Vence en {daysUntilExpiry}d ({effectiveDate})
      </Badge>
    );
  }

  if (status === "warning") {
    return (
      <Badge tone="aviso">
        Vence en {daysUntilExpiry}d ({effectiveDate})
      </Badge>
    );
  }

  if (status === "good") {
    return (
      <Badge tone="exito">
        En fecha ({effectiveDate})
      </Badge>
    );
  }

  return <Badge tone="neutro">Sin vencimiento</Badge>;
}
