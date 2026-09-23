import { describe, expect, it } from "vitest";
import { allocateByFefo } from "./fefo";
import type { StockLot } from "./types";

function mockLot(overrides: Partial<StockLot>): StockLot {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    presentation_id: "pres-1",
    supplier_id: null,
    initial_quantity: 10,
    current_quantity: overrides.current_quantity ?? 10,
    purchase_cost: 100,
    received_at: overrides.received_at ?? "2026-01-01T00:00:00Z",
    manufacturer_expiry_date: null,
    opened_at: null,
    portioned_at: null,
    status: overrides.status ?? "open",
    created_at: "2026-01-01T00:00:00Z",
    product_id: "prod-1",
    product_name: "Lentejas",
    presentation_name: "Bolsa 1kg",
    base_unit: "gram",
    base_quantity: 1000,
    open_shelf_life_days: null,
    supplier_name: null,
    effective_expiry_date: overrides.effective_expiry_date ?? null,
    expiry_status: "good",
    days_until_expiry: 100,
    ...overrides,
  };
}

describe("FEFO stock allocation (RF-09)", () => {
  it("descuenta de un único lote cuando el stock es suficiente", () => {
    const lot = mockLot({ id: "lot-1", current_quantity: 10, effective_expiry_date: "2026-05-01" });
    const result = allocateByFefo([lot], 4);

    expect(result.fulfilled).toBe(true);
    expect(result.allocatedQuantity).toBe(4);
    expect(result.missingQuantity).toBe(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      lotId: "lot-1",
      quantityToDeduct: 4,
      remainingInLot: 6,
      shouldClose: false,
      effectiveExpiryDate: "2026-05-01",
    });
  });

  it("prioriza el lote que vence antes, sin importar la fecha de ingreso (FEFO puro)", () => {
    // lotA ingresó primero pero vence DESPUÉS
    const lotA = mockLot({
      id: "lot-A",
      received_at: "2026-01-01T00:00:00Z",
      effective_expiry_date: "2026-12-01",
      current_quantity: 5,
    });
    // lotB ingresó después pero vence ANTES
    const lotB = mockLot({
      id: "lot-B",
      received_at: "2026-02-01T00:00:00Z",
      effective_expiry_date: "2026-04-01",
      current_quantity: 5,
    });

    // Pedimos 3 unidades: debe sacarlas de lotB porque vence en abril
    const result = allocateByFefo([lotA, lotB], 3);

    expect(result.fulfilled).toBe(true);
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item?.lotId).toBe("lot-B");
    expect(item?.quantityToDeduct).toBe(3);
    expect(item?.remainingInLot).toBe(2);
  });

  it("descuenta en cadena entre múltiples lotes y marca shouldClose al vaciar un lote", () => {
    const lot1 = mockLot({ id: "lot-1", current_quantity: 3, effective_expiry_date: "2026-03-01" });
    const lot2 = mockLot({ id: "lot-2", current_quantity: 4, effective_expiry_date: "2026-06-01" });

    // Pedimos 5 unidades: consume los 3 de lot1 (y lo cierra) y 2 de lot2
    const result = allocateByFefo([lot1, lot2], 5);

    expect(result.fulfilled).toBe(true);
    expect(result.allocatedQuantity).toBe(5);
    expect(result.items).toHaveLength(2);

    expect(result.items[0]).toEqual({
      lotId: "lot-1",
      quantityToDeduct: 3,
      remainingInLot: 0,
      shouldClose: true,
      effectiveExpiryDate: "2026-03-01",
    });

    expect(result.items[1]).toEqual({
      lotId: "lot-2",
      quantityToDeduct: 2,
      remainingInLot: 2,
      shouldClose: false,
      effectiveExpiryDate: "2026-06-01",
    });
  });

  it("ignora lotes cerrados o con cantidad 0", () => {
    const closedLot = mockLot({ id: "closed", status: "closed", current_quantity: 10 });
    const emptyLot = mockLot({ id: "empty", current_quantity: 0 });
    const activeLot = mockLot({ id: "active", current_quantity: 5, effective_expiry_date: "2026-08-01" });

    const result = allocateByFefo([closedLot, emptyLot, activeLot], 2);

    expect(result.fulfilled).toBe(true);
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item?.lotId).toBe("active");
  });

  it("indica falta de stock si la cantidad solicitada supera el total disponible", () => {
    const lot = mockLot({ id: "lot-1", current_quantity: 3 });
    const result = allocateByFefo([lot], 10);

    expect(result.fulfilled).toBe(false);
    expect(result.allocatedQuantity).toBe(3);
    expect(result.missingQuantity).toBe(7);
  });
});
