import type { LotExpiryStatus } from "./types";

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
    const openedDate = new Date(openedAt);
    openedDate.setDate(openedDate.getDate() + openShelfLifeDays);
    openedExpiry = openedDate.toISOString().slice(0, 10);
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
  ref.setHours(0, 0, 0, 0);

  const exp = new Date(effectiveExpiryDate);
  exp.setHours(0, 0, 0, 0);

  const diffTime = exp.getTime() - ref.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
