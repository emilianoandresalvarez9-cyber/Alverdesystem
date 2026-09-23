// Precios de presentaciones "Balanza" (ADR-001): la dueña piensa en precio por kilo;
// la base guarda precio por gramo (sale_price con 2 decimales, base_quantity = 1).

/** El precio por gramo es exacto con 2 decimales si el precio por kilo es múltiplo de $10. */
export function validatePricePerKilo(pricePerKg: number): string | null {
  if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) return "Indicá el precio por kilo.";
  if (Math.round(pricePerKg * 100) % 1000 !== 0) return "El precio por kilo tiene que ser múltiplo de $10 (por ejemplo, $3.150 y no $3.155).";
  return null;
}

/** Precio por kilo a partir del precio por gramo guardado. */
export function pricePerKiloFromGram(pricePerGram: number): number {
  return Math.round(pricePerGram * 100000) / 100;
}

/** Texto de precio de una presentación, para catálogo y caja. */
export function presentationPriceLabel(presentation: { sale_price: number; sold_by_weight: boolean }, format: (value: number) => string): string {
  return presentation.sold_by_weight
    ? `${format(pricePerKiloFromGram(presentation.sale_price))}/kg`
    : format(presentation.sale_price);
}
