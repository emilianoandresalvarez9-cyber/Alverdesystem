import type { StockLot } from "../stock/types";
import type { ProductPresentation } from "../catalog/types";

export interface FractioningParams {
  originLotQuantity: number;
  targetBaseQuantity: number;
  packetsToProduce: number;
  bagFinished: boolean; // ¿La bolsa de origen se terminó? (RF-15)
  realRemainingGrams: number; // Por defecto 0 si se terminó
}

export interface FractioningCalculation {
  gramsNeeded: number;
  theoreticalRemaining: number;
  merma: number;
  newOriginQuantity: number;
  originLotStatus: "open" | "closed";
}

export interface ProductShelfLifeItem {
  id: string;
  name: string;
  brand_name: string | null;
  category_name: string | null;
  base_unit: string;
  open_shelf_life_days: number | null;
}
