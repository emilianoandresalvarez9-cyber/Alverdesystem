// Aritmética de dinero con enteros para coincidir exactamente con `round(qty * price, 2)`
// de Postgres (numeric). Cantidades con hasta 3 decimales; precios con hasta 2.

/** Redondea una cantidad a 3 decimales, como numeric(14, 3). */
export function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/** Redondea un importe a 2 decimales, mitad hacia arriba. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Subtotal exacto de una línea: evita que 0.35 × 3000 dé 1050.0000000000002. */
export function lineSubtotal(quantity: number, unitPrice: number): number {
  const milli = Math.round(roundQuantity(quantity) * 1000);
  const cents = Math.round(roundMoney(unitPrice) * 100);
  const product = milli * cents; // en cienmilésimos de peso
  const roundedCents = Math.sign(product) * Math.floor((Math.abs(product) + 500) / 1000);
  return roundedCents / 100;
}

export function sumMoney(values: number[]): number {
  return values.reduce((acc, value) => acc + Math.round(value * 100), 0) / 100;
}

const formatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });

export function formatMoney(value: number): string {
  return formatter.format(value);
}
