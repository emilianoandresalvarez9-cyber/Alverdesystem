import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  enqueueOperation,
  markOperationFailed,
  markOperationSynced,
  pendingOperations,
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

  it("removes an event from pending only after it is synchronized", async () => {
    const operation = await enqueueOperation({
      kind: "credit_movement",
      payload: { amount: 10 }
    });

    await markOperationSynced(operation.localId);

    expect(await pendingOperations()).toEqual([]);
  });
});
