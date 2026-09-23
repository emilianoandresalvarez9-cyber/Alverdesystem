import { describe, expect, it } from "vitest";
import { allocateByFefo } from "./modules/stock/fefo";
import type { StockLot } from "./modules/stock/types";

describe("Integration QA - Flujos Cruzados", () => {
  it("Una venta registrada por Caja descuenta correctamente el stock (FEFO)", () => {
    // 1. Simulamos el stock actual (Agente E)
    const lotA: StockLot = {
      id: "lot-1",
      presentation_id: "pres-1",
      product_id: "prod-1",
      current_quantity: 5,
      status: "open",
      manufacturer_expiry_date: "2026-10-01",
      received_at: "2026-01-01",
      // ... otros campos obligatorios mockeados
      supplier_id: null, initial_quantity: 10, purchase_cost: 100, opened_at: null, portioned_at: null,
      created_at: "2026-01-01", product_name: "A", presentation_name: "A", base_unit: "gram", base_quantity: 1000,
      open_shelf_life_days: null, supplier_name: null, effective_expiry_date: "2026-10-01", expiry_status: "good", days_until_expiry: 100
    };

    const lotB: StockLot = {
      ...lotA,
      id: "lot-2",
      current_quantity: 10,
      status: "open",
      manufacturer_expiry_date: "2026-12-01",
    };

    const initialLots = [lotA, lotB];

    // 2. Simulamos el Payload generado por el Carrito de Caja (Agente 5 / H)
    const salePayload = {
      items: [
        { presentationId: "pres-1", quantity: 8, unitPrice: 500 }
      ]
    };

    // 3. Ejecutamos la alocacion cruzada (lo que hace el RPC en la DB)
    const allocations = allocateByFefo(initialLots, salePayload.items[0]!.quantity);

    // 4. Verificamos los resultados (QA)
    // El lote A deberia vaciarse (5 unidades) y el lote B deberia aportar 3 unidades
    expect(allocations.items.length).toBe(2);
    expect(allocations.items[0]!.lotId).toBe("lot-1");
    expect(allocations.items[0]!.quantityToDeduct).toBe(5);
    
    expect(allocations.items[1]!.lotId).toBe("lot-2");
    expect(allocations.items[1]!.quantityToDeduct).toBe(3);
  });
});
