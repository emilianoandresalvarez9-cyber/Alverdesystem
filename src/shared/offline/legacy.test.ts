import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { enqueueOperation, markOperationFailed, pendingOperations, resetOfflineStorageForTests } from "./queue";
import { upgradeLegacyOperations } from "./legacy";

describe("migración de faltantes viejos en la cola (RF-49)", () => {
  afterEach(async () => {
    await resetOfflineStorageForTests();
  });

  it("convierte el aviso trabado a missing_item sin cambiar su localId", async () => {
    const legacy = await enqueueOperation({
      kind: "stock_movement",
      payload: { movementKind: "adjustment", productId: "prod-1", reason: "Faltante reportado offline: Pasas" }
    });
    await markOperationFailed(legacy.localId, "null value in column quantity");
    const realAdjustment = await enqueueOperation({
      kind: "stock_movement",
      payload: { movementKind: "adjustment", productId: "prod-2", quantity: -1, reason: "Rotura" }
    });

    expect(await upgradeLegacyOperations()).toBe(1);

    const pending = await pendingOperations();
    const upgraded = pending.find((o) => o.localId === legacy.localId);
    expect(upgraded?.kind).toBe("missing_item");
    expect(upgraded?.payload).toMatchObject({ productId: "prod-1" });
    expect(upgraded?.failedAt).toBeUndefined();
    expect(pending.find((o) => o.localId === realAdjustment.localId)?.kind).toBe("stock_movement");
    expect(await upgradeLegacyOperations()).toBe(0);
  });
});
