/**
 * Datos para los gráficos de Reportes dibujados con CSS (sistema de diseño): barras a escala,
 * una sola serie, sin colores de acento. Antes eran gráficos de recharts (~460 kB).
 */
import { localDayKey } from "./salesReport";

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export type DayBar = {
  day: string;
  weekday: string;
  dayOfMonth: number;
  total: number;
  /** Alto de la barra, 0 a 100 respecto del máximo del eje. */
  percent: number;
  /** Hoy: el día todavía no terminó (barra rayada, «en curso»). */
  today: boolean;
  /** El día de más ventas lleva su valor escrito. */
  highlight: boolean;
};

export type AxisTick = { value: number; percent: number; label: string };

/** «$950», «$214 mil», «$1,2 M». */
export function shortMoney(value: number): string {
  if (value >= 1_000_000) return `$${(Math.round(value / 100_000) / 10).toLocaleString("es-AR")} M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000).toLocaleString("es-AR")} mil`;
  return `$${Math.round(value).toLocaleString("es-AR")}`;
}

/** Tope del eje redondeado hacia arriba a 1, 2, 2,5 o 5 × 10ⁿ. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value) ?? 10;
  return step * power;
}

/**
 * Una barra por día del rango, con los días sin ventas en cero, para que el eje sea el
 * calendario y no sólo los días con datos.
 */
export function dailyBars(salesByDay: { day: string; total: number }[], days: number, now: Date = new Date()): { bars: DayBar[]; ticks: AxisTick[] } {
  const totals = new Map(salesByDay.map((d) => [d.day, d.total]));
  const todayKey = localDayKey(now.toISOString());
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 12);
    keys.push(localDayKey(date.toISOString()));
  }
  const max = niceMax(Math.max(0, ...keys.map((k) => totals.get(k) ?? 0)));
  const top = Math.max(0, ...keys.map((k) => totals.get(k) ?? 0));
  const bars = keys.map((key) => {
    const [y, m, d] = key.split("-").map(Number) as [number, number, number];
    const total = totals.get(key) ?? 0;
    return {
      day: key,
      weekday: key === todayKey ? "hoy" : WEEKDAYS[new Date(y, m - 1, d).getDay()]!,
      dayOfMonth: d,
      total,
      percent: max > 0 ? Math.round((total / max) * 1000) / 10 : 0,
      today: key === todayKey,
      highlight: top > 0 && total === top
    };
  });
  // Sólo un destacado aunque haya empate: el primero.
  let marked = false;
  for (const bar of bars) {
    if (bar.highlight && !marked) marked = true;
    else bar.highlight = false;
  }
  const ticks = max > 0
    ? [0, 0.5, 1].map((f) => ({ value: max * f, percent: f * 100, label: shortMoney(max * f) }))
    : [{ value: 0, percent: 0, label: "$0" }];
  return { bars, ticks };
}

/** Porcentaje entero para las barras horizontales y el texto «38 %». */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
