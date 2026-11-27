// Cantidades de stock escritas a mano. La base guarda numeric(14,3): más de tres decimales se
// rechaza para siempre (22023), así que se valida el TEXTO antes de mandar o encolar. Comparar
// números (Math.round(q * 1000) !== q * 1000) rechazaba cantidades válidas como 1.005.

export type QuantityCheck = { ok: true; quantity: number } | { ok: false; reason: string };

const UP_TO_THREE_DECIMALS = /^\d+(\.\d{1,3})?$/;

/** Acepta coma o punto decimal. Mayor que cero y con hasta tres decimales. */
export function parseStockQuantity(raw: string, emptyReason = "Ingresá una cantidad mayor a 0."): QuantityCheck {
  const text = raw.trim().replace(",", ".");
  const quantity = Number(text);
  if (text === "" || !Number.isFinite(quantity) || quantity <= 0) return { ok: false, reason: emptyReason };
  if (!UP_TO_THREE_DECIMALS.test(text)) return { ok: false, reason: "Hasta tres decimales." };
  return { ok: true, quantity };
}
