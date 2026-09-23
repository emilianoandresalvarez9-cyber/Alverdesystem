import { describe, expect, it } from "vitest";
import type { QueuedOperation } from "../../shared/offline/types";
import { summarizeShift } from "./shiftSummary";

const sale = (shiftId: string, paymentMethod: string, totalAmount: number, synced = true): QueuedOperation => ({
  localId: crypto.randomUUID(), deviceId: "d", kind: "sale", createdAt: new Date().toISOString(),
  payload: { shiftId, paymentMethod, totalAmount, items: [] },
  ...(synced ? { syncedAt: new Date().toISOString() } : {})
});

describe("summarizeShift (RF-32)", () => {
  it("separa el total por medio de pago y cuenta lo pendiente", () => {
    const summary = summarizeShift([
      sale("t1", "cash", 1000.1),
      sale("t1", "cash", 0.2, false),
      sale("t1", "transfer", 2500),
      sale("t1", "credit", 700),
      sale("otro-turno", "cash", 99999),
      { localId: "x", deviceId: "d", kind: "credit_movement", createdAt: "", payload: { amount: 5 } }
    ], "t1");

    expect(summary.byMethod.cash).toEqual({ count: 2, total: 1000.3 });
    expect(summary.byMethod.transfer.total).toBe(2500);
    expect(summary.byMethod.qr.count).toBe(0);
    expect(summary.byMethod.credit.total).toBe(700);
    expect(summary.total).toBe(4200.3);
    expect(summary.salesCount).toBe(4);
    expect(summary.pendingSync).toBe(1);
  });
});
