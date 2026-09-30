import { describe, expect, it } from "vitest";
import type { QueuedOperation } from "../../shared/offline/types";
import type { StockLot } from "./types";
import { withPendingStockOperations } from "./offlineStock";

const lot: StockLot = {
  id: "lot-1",
  presentation_id: "presentation-bulk",
  supplier_id: null,
  initial_quantity: 100,
  current_quantity: 100,
  received_at: "2026-09-30T10:00:00.000Z",
  manufacturer_expiry_date: null,
  opened_at: null,
  portioned_at: null,
  status: "open",
  created_at: "2026-09-30T10:00:00.000Z",
  product_id: "product-1",
  product_name: "Producto",
  presentation_name: "Granel",
  base_unit: "gram",
  base_quantity: 1,
  sold_by_weight: true,
  open_shelf_life_days: 30,
  supplier_name: null,
  effective_expiry_date: null,
  expiry_status: "indeterminate",
  days_until_expiry: null,
};

function operation(localId: string, payload: Record<string, unknown>): QueuedOperation {
  return {
    localId,
    deviceId: "device-1",
    kind: "stock_movement",
    payload,
    createdAt: "2026-09-30T12:00:00.000Z",
  };
}

describe("operaciones de stock pendientes", () => {
  it("refleja un ajuste aditivo pendiente sin tocar el stock del servidor", () => {
    const result = withPendingStockOperations([lot], [
      operation("adjustment-add-1", { action: "adjust_stock", lotId: "lot-1", quantity: 25 }),
    ]);

    expect(result[0]?.current_quantity).toBe(125);
    expect(lot.current_quantity).toBe(100);
  });

  it("muestra ajustes aditivos sin sobrescribir el lote y cierra al llegar a cero", () => {
    const result = withPendingStockOperations([lot], [
      operation("adjustment-1", { action: "adjust_stock", lotId: "lot-1", quantity: 5 }),
      operation("adjustment-2", { action: "adjust_stock", lotId: "lot-1", quantity: -105 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ current_quantity: 0, status: "closed" });
  });

  it("muestra un lote temporal de ingreso sin costos locales", () => {
    const result = withPendingStockOperations([lot], [operation("receipt-1", {
      action: "quick_restock",
      targetPresentationId: "presentation-bulk",
      productId: "product-1",
      productName: "Producto",
      presentationName: "Granel",
      baseUnit: "gram",
      baseQuantity: 1,
      soldByWeight: true,
      quantity: 250,
    })]);

    expect(result).toHaveLength(2);
    expect(result.find((row) => row.id === "pending:receipt-1")).toMatchObject({
      current_quantity: 250,
      product_name: "Producto",
      presentation_name: "Granel",
    });
    expect(JSON.stringify(result)).not.toContain("purchase_cost");
  });

  it("conserva el remanente y agrega la presentación creada al fraccionar offline", () => {
    const result = withPendingStockOperations([lot], [operation("fraction-1", {
      action: "fraction_stock",
      originLotId: "lot-1",
      targetPresentationId: "presentation-packet",
      productId: "product-1",
      productName: "Producto",
      presentationName: "Paquete 10 g",
      baseUnit: "gram",
      baseQuantity: 10,
      packetsNum: 2,
      newOriginQuantity: 70,
      originLotStatus: "closed",
    })]);

    expect(result.find((row) => row.id === "lot-1")?.current_quantity).toBe(70);
    expect(result.find((row) => row.id === "lot-1")?.status).toBe("closed");
    expect(result.find((row) => row.id === "pending:fraction-1")).toMatchObject({
      current_quantity: 2,
      presentation_id: "presentation-packet",
      portioned_at: "2026-09-30T12:00:00.000Z",
    });
  });

  it("refleja la apertura offline del lote", () => {
    const result = withPendingStockOperations([lot], [operation("open-1", {
      action: "open_lot",
      lotId: "lot-1",
    })]);

    expect(result[0]?.opened_at).toBe("2026-09-30T12:00:00.000Z");
  });
});

