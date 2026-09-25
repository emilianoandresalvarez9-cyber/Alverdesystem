/** Normaliza el EAN/UPC del envase sin convertirlo a número ni perder ceros iniciales. */
export function normalizeManufacturerBarcode(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
