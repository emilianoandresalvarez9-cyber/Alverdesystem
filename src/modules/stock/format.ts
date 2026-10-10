/**
 * Formato de cantidades y fechas de Stock, como pide el sistema de diseño:
 * `825 / 1.000 g`, `29/09/2026`. Sin unidades en inglés ni horas corridas por zona horaria.
 */

const UNIT_LABEL: Record<string, string> = { gram: "g", millilitre: "ml", unit: "u" };

export function unitLabel(baseUnit: string): string {
  return UNIT_LABEL[baseUnit] ?? baseUnit;
}

const quantity = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

/** 1000 → «1.000», 0.35 → «0,35». */
export function formatAmount(value: number): string {
  return quantity.format(value);
}

/** «825 g», «12 u». */
export function formatQuantity(value: number, baseUnit: string): string {
  return `${formatAmount(value)} ${unitLabel(baseUnit)}`;
}

export { formatDay, formatDayTime } from "../../shared/format/date";

/** Cuánto queda del lote, para el medidor: 0 a 100, y si conviene avisar. */
export function remaining(current: number, initial: number): { percent: number; tone: "normal" | "aviso" | "error" } {
  if (!(initial > 0)) return { percent: 0, tone: "normal" };
  const percent = Math.max(0, Math.min(100, Math.round((current / initial) * 100)));
  return { percent, tone: percent <= 20 ? "error" : percent <= 40 ? "aviso" : "normal" };
}
