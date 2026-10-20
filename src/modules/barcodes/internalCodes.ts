type BaseUnit = "gram" | "millilitre" | "unit";

export interface InternalCodeCandidate {
  active: boolean;
  internal_barcode: string | null;
  product: { base_unit: BaseUnit; manufacturer_barcode: string | null; active: boolean } | null;
}

/**
 * RF-20: llevan código propio lo que se vende a granel o fracciona o elabora el local. Son las
 * presentaciones de productos en gramos o mililitros, y las de productos por unidad sin código
 * del fabricante (un budín casero). Sin código no se pueden escanear en Caja ni en el ingreso.
 */
export function needsInternalCode(candidate: InternalCodeCandidate): boolean {
  const product = candidate.product;
  if (!product || !product.active || !candidate.active || candidate.internal_barcode) return false;
  return product.base_unit !== "unit" || !product.manufacturer_barcode;
}

/** Unidades que se pesan o miden en la balanza: van en la planilla del mostrador (RF-22). */
export const BULK_UNITS: BaseUnit[] = ["gram", "millilitre"];
