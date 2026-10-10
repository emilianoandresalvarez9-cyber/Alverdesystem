/**
 * Fechas en formato argentino, iguales en todos los navegadores: `09/10/2026`, `09/10 11:15`.
 * Se arman a mano porque Intl con es-AR no siempre respeta los dos dígitos sin el año.
 */
const two = (n: number) => String(n).padStart(2, "0");

/**
 * «29/09/2026». Una fecha sola («2026-09-29», vencimientos) se arma con sus partes: con
 * `new Date()` se leería como medianoche UTC y en Argentina mostraría el día anterior.
 */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** «09/10 11:15»: para movimientos y traspasos recientes, en la hora local del equipo. */
export function formatDayTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${two(date.getDate())}/${two(date.getMonth() + 1)} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
