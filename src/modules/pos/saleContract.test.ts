import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { enqueueOperation, pendingOperations, resetOfflineStorageForTests } from "../../shared/offline/queue";
import { buildSalePayload } from "./cart";
import { PAYMENT_METHODS, type CartLine } from "./types";

const migration = readFileSync("supabase/migrations/20260923110000_contrato_venta.sql", "utf8");

const line: CartLine = {
  lineId: "l1",
  quantity: 2,
  entry: {
    presentationId: "00000000-0000-0000-0000-0000000000c1", productId: "p", productName: "Nueces", presentationName: "250 g",
    baseUnit: "gram", baseQuantity: 250, salePrice: 1500, soldByWeight: false, internalBarcode: null, manufacturerBarcode: null
  }
};

describe("contrato caja ↔ process_offline_sale", () => {
  afterEach(async () => {
    await resetOfflineStorageForTests();
  });

  it("la operación encolada tiene cada campo que lee la RPC", async () => {
    const payload = buildSalePayload([line], { shiftId: "turno-1", paymentMethod: "transfer", newId: () => crypto.randomUUID() });
    await enqueueOperation({ kind: "sale", payload });
    const [operation] = await pendingOperations();

    // Campos de la operación: payload ->> 'localId' | 'deviceId' | 'kind' | 'createdAt'
    for (const key of ["localId", "deviceId", "kind", "createdAt"] as const) {
      expect(migration).toContain(`payload ->> '${key}'`);
      expect(operation?.[key]).toBeTruthy();
    }
    // Campos de la venta: v_sale ->> 'paymentMethod' | 'customerId' | 'shiftId' | 'totalAmount'
    for (const key of ["paymentMethod", "shiftId", "totalAmount"]) {
      expect(migration).toContain(`v_sale ->> '${key}'`);
      expect(operation?.payload).toHaveProperty(key);
    }
    // Campos de cada ítem: v_item ->> 'presentationId' | 'quantity' | 'unitPrice' | 'localId'
    const item = (operation?.payload as { items: Record<string, unknown>[] }).items[0];
    for (const key of ["presentationId", "quantity", "unitPrice", "localId"]) {
      expect(migration).toContain(`v_item ->> '${key}'`);
      expect(item).toHaveProperty(key);
    }
  });

  it("los medios de pago del frontend son exactamente los del enum de la base", () => {
    const enumDef = readFileSync("supabase/migrations/20260922060000_phase_0_foundation.sql", "utf8")
      .match(/create type public\.payment_method as enum \(([^)]+)\)/)?.[1] ?? "";
    const dbValues = [...enumDef.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect([...PAYMENT_METHODS].sort()).toEqual(dbValues.sort());
  });
});
