import type { FractioningParams, FractioningCalculation } from "./types";

/**
 * Calcula los valores teóricos, consumos y mermas del proceso de fraccionamiento (RF-13 a RF-16).
 */
export function calculateFractioning(params: FractioningParams): FractioningCalculation {
  const { originLotQuantity, targetBaseQuantity, packetsToProduce, bagFinished, realRemainingGrams } = params;

  if (originLotQuantity < 0 || targetBaseQuantity <= 0 || packetsToProduce < 0) {
    throw new Error("Valores de entrada inválidos para fraccionamiento.");
  }

  const gramsNeeded = Number((packetsToProduce * targetBaseQuantity).toFixed(3));
  const theoreticalRemaining = Number((originLotQuantity - gramsNeeded).toFixed(3));

  if (theoreticalRemaining < 0) {
    throw new Error(`Stock insuficiente. Se necesitan ${gramsNeeded} g pero hay ${originLotQuantity} g disponibles.`);
  }

  let merma = 0;
  let newOriginQuantity = theoreticalRemaining;
  let originLotStatus: "open" | "closed" = "open";

  if (bagFinished) {
    // RF-15 y RF-16: Si la bolsa se terminó, calcular merma
    const realRem = Math.max(0, realRemainingGrams); // No puede ser negativo
    
    // La merma es lo que teóricamente debía quedar menos lo que realmente se recuperó
    merma = Number(Math.max(0, theoreticalRemaining - realRem).toFixed(3));
    
    // Si la bolsa se terminó, el stock utilizable se asume consumido/transferido
    newOriginQuantity = realRem;
    originLotStatus = "closed";
    
    // Si no quedó remanente físico (terminada 100%), lo restante en base de datos es 0
    if (realRem === 0) {
      newOriginQuantity = 0;
    }
  }

  return {
    gramsNeeded,
    theoreticalRemaining,
    merma,
    newOriginQuantity,
    originLotStatus,
  };
}

/**
 * Valida que los días de vida útil sean válidos (RF-17).
 */
export function validateShelfLifeDays(days: number | null): boolean {
  if (days === null) return true;
  return Number.isInteger(days) && days > 0;
}
