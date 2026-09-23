import { describe, expect, it } from "vitest";
import type { QueuedOperation } from "../../shared/offline/types";
import { exceedsLimit, filterAccounts, movementDelta, pendingDeltas, withPending } from "./balance";
import type { CustomerAccount } from "./types";

const account = (over: Partial<CustomerAccount>): CustomerAccount => ({
  id: "c1", name: "Marta Gómez", phone: "11 5555-0000", credit_limit: null, active: true, balance: 0, last_movement_at: null, ...over
});
const op = (kind: QueuedOperation["kind"], payload: Record<string, unknown>, synced = false): QueuedOperation => ({
  localId: crypto.randomUUID(), deviceId: "d", kind, createdAt: "", payload, ...(synced ? { syncedAt: "x" } : {})
});

describe("saldo de fiado (RF-46, RF-48)", () => {
  it("cargo suma, abono resta, ajuste según el sentido", () => {
    expect(movementDelta({ movementKind: "charge", amount: 100 })).toBe(100);
    expect(movementDelta({ movementKind: "payment", amount: 100 })).toBe(-100);
    expect(movementDelta({ movementKind: "adjustment", amount: 100, adjustmentSign: 1 })).toBe(100);
    expect(movementDelta({ movementKind: "adjustment", amount: 100, adjustmentSign: -1 })).toBe(-100);
  });

  it("suma lo que está en la cola sin enviar, incluidas las ventas fiadas", () => {
    const pending = pendingDeltas([
      op("credit_movement", { customerId: "c1", movementKind: "payment", amount: 300.1 }),
      op("sale", { paymentMethod: "credit", customerId: "c1", totalAmount: 1000.2 }),
      op("sale", { paymentMethod: "cash", customerId: "c1", totalAmount: 99999 }),
      op("credit_movement", { customerId: "c1", movementKind: "charge", amount: 5000 }, true)
    ]);
    expect(pending.get("c1")).toBe(700.1);
    expect(withPending([account({ balance: 2000 })], pending)[0]?.balance).toBe(2700.1);
  });
});

describe("tope y buscador (RF-45, RF-47)", () => {
  it("avisa solo si la venta supera el tope definido", () => {
    expect(exceedsLimit(account({ balance: 1500, credit_limit: 2000 }), 500)).toBe(false);
    expect(exceedsLimit(account({ balance: 1500, credit_limit: 2000 }), 500.01)).toBe(true);
    expect(exceedsLimit(account({ balance: 99999, credit_limit: null }), 1)).toBe(false);
  });

  it("busca por nombre sin tildes o por teléfono", () => {
    const list = [account({}), account({ id: "c2", name: "Juan Pérez", phone: null })];
    expect(filterAccounts(list, "gomez").map((a) => a.id)).toEqual(["c1"]);
    expect(filterAccounts(list, "5555").map((a) => a.id)).toEqual(["c1"]);
    expect(filterAccounts(list, "")).toHaveLength(2);
  });
});
