export interface LotCostSnapshot {
  presentation_id: string;
  purchase_cost: number;
  received_at: string;
  portioned_at?: string | null;
}

export function latestLotCost(lots: LotCostSnapshot[], presentationId: string): number | null {
  const latestLot = lots
    .filter(lot => lot.presentation_id === presentationId)
    .reduce<LotCostSnapshot | null>((latest, lot) => {
      const lotCostDate = lot.portioned_at ?? lot.received_at;
      const latestCostDate = latest ? latest.portioned_at ?? latest.received_at : null;
      if (!latest || Date.parse(lotCostDate) > Date.parse(latestCostDate!)) return lot;
      return latest;
    }, null);

  if (!latestLot || !Number.isFinite(latestLot.purchase_cost) || latestLot.purchase_cost <= 0) return null;
  return latestLot.purchase_cost;
}

export function grossMarginPercentage(cost: number, salePrice: number): number {
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(salePrice) || salePrice <= 0) return 0;
  return ((salePrice - cost) / salePrice) * 100;
}

export function marginTone(marginPercentage: number): "aviso" | "error" | "exito" {
  if (marginPercentage < 0) return "error";
  if (marginPercentage < 20) return "aviso";
  return "exito";
}
