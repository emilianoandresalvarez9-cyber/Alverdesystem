import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  enqueueOperation,
  markOperationFailed,
  markOperationSynced,
  pendingOperations,
  pendingOperationStatus,
  resetOfflineStorageForTests
} from "./queue";

describe("offline operation queue", () => {
  afterEach(async () => {
    await resetOfflineStorageForTests();
  });

  it("persists operations and keeps failed events for retry", async () => {
    const operation = await enqueueOperation({
      kind: "stock_movement",
      payload: { quantity: 1 }
    });

    await markOperationFailed(operation.localId, "offline");
    const pending = await pendingOperations();

    expect(pending).toHaveLength(1);
    expect(pending[0]?.localId).toBe(operation.localId);
    expect(pending[0]?.failureMessage).toBe("offline");
  });

  it("keeps permanent server rejections visible and pending", async () => {
    const operation = await enqueueOperation({
      kind: "sale",
      payload: { shiftId: "shift-1" }
    });

    await markOperationFailed(operation.localId, "customer does not exist", "23503", false);

    expect(await pendingOperations()).toHaveLength(1);
    expect(await pendingOperationStatus()).toMatchObject({
      total: 1,
      rejected: 1,
      lastError: "customer does not exist"
    });
  });

  it("removes an event from pending only after it is synchronized", async () => {
    const operation = await enqueueOperation({
      kind: "credit_movement",
      payload: { amount: 10 }
    });

    await markOperationSynced(operation.localId);

    expect(await pendingOperations()).toEqual([]);
  });
});
