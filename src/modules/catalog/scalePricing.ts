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

/** Valor inicial del diálogo "Cambiar precio": por kilo en Balanza, como se muestra en la tabla. */
export function priceEditStart(presentation: { sale_price: number; sold_by_weight: boolean }): string {
  const price = Number(presentation.sale_price);
  return String(presentation.sold_by_weight ? pricePerKiloFromGram(price) : price);
}

/** Precio a guardar en `sale_price`: en Balanza se carga por kilo y se guarda por gramo. */
export function parseEditedPrice(input: string, soldByWeight: boolean): { ok: true; salePrice: number } | { ok: false; error: string } {
  const value = input.trim() === "" ? Number.NaN : Number(input);
  if (soldByWeight) {
    const error = validatePricePerKilo(value);
    return error ? { ok: false, error } : { ok: true, salePrice: Math.round(value / 10) / 100 };
  }
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: "Ingresá un precio válido mayor o igual a 0." };
  return { ok: true, salePrice: value };
}

/** Texto de precio de una presentación, para catálogo y caja. */
export function presentationPriceLabel(presentation: { sale_price: number; sold_by_weight: boolean }, format: (value: number) => string): string {
  return presentation.sold_by_weight
    ? `${format(pricePerKiloFromGram(presentation.sale_price))}/kg`
    : format(presentation.sale_price);
}
