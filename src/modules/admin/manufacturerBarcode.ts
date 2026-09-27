/** Keeps manufacturer codes as text so leading zeroes remain significant. */
export function normalizeManufacturerBarcode(value: string): string | null {
  const barcode = value.trim();
  return barcode.length > 0 ? barcode : null;
}
