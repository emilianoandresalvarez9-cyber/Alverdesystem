import type { LotExpiryStatus } from "./types";

/**
 * Convierte una cadena de fecha ("YYYY-MM-DD" o timestamp ISO) en una fecha local.
 * Una fecha sola ("YYYY-MM-DD") se construye con `new Date(y, m - 1, d)` porque
 * `new Date("YYYY-MM-DD")` se interpreta en medianoche UTC y en Argentina (UTC-3)
 * queda a las 21:00 del día anterior.
 */
function parseLocalDate(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(value);
}

function formatLocalIsoDate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * RF-08: Calcula el vencimiento efectivo de un lote tomando el más próximo
 * entre el vencimiento del fabricante y el vencimiento por apertura (si aplica).
 */
export function calculateEffectiveExpiry(
  manufacturerExpiry: string | null,
  openedAt: string | null,
  openShelfLifeDays: number | null
): string | null {
  let openedExpiry: string | null = null;

  if (openedAt && openShelfLifeDays != null && openShelfLifeDays > 0) {
    const openedDate = parseLocalDate(openedAt);
    if (!Number.isNaN(openedDate.getTime())) {
      openedDate.setDate(openedDate.getDate() + openShelfLifeDays);
      openedExpiry = formatLocalIsoDate(openedDate);
    }
  }

  const mfg = manufacturerExpiry ? manufacturerExpiry.slice(0, 10) : null;

  if (mfg && openedExpiry) {
    return mfg < openedExpiry ? mfg : openedExpiry;
  }

  return mfg ?? openedExpiry;
}

/**
 * Calcula la cantidad de días restantes hasta el vencimiento efectivo.
 * Negativo indica que ya venció.
 */
export function getDaysUntilExpiry(
  effectiveExpiryDate: string | null,
  referenceDate: Date = new Date()
): number | null {
  if (!effectiveExpiryDate) return null;

  const ref = new Date(referenceDate);
  if (Number.isNaN(ref.getTime())) return null;
  ref.setHours(0, 0, 0, 0);

  const exp = parseLocalDate(effectiveExpiryDate);
  if (Number.isNaN(exp.getTime())) return null;
  exp.setHours(0, 0, 0, 0);

  const diffDays = Math.round((exp.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays === 0 ? 0 : diffDays;
}

/**
 * Determina el estado semafórico del vencimiento (RF-10):
 * - expired: vencido (< 0 días)
 * - critical: vence en 7 días o menos
 * - warning: vence en 30 días o menos
 * - good: vence en más de 30 días
 * - indeterminate: sin fecha definida
 */
export function evaluateExpiryStatus(daysUntilExpiry: number | null): LotExpiryStatus {
  if (daysUntilExpiry === null) return "indeterminate";
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 7) return "critical";
  if (daysUntilExpiry <= 30) return "warning";
  return "good";
}
