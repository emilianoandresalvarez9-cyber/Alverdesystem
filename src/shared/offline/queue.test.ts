import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  enqueueOperation,
  markOperationSynced,
  pendingOperationCount,
  pendingOperations,
  resetOfflineStorageForTests,
  saveCatalogSnapshot,
  loadCatalogSnapshot
} from "./queue";

afterEach(async () => {
  await resetOfflineStorageForTests();
});

describe("cola offline", () => {
  it("persiste una operación antes de enviarla y la deja pendiente", async () => {
    const operation = await enqueueOperation({
      kind: "stock_movement",
      payload: { movementKind: "adjustment", productId: "product-1", quantity: -1 }
    });

    expect(operation.localId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await pendingOperationCount()).toBe(1);
    expect((await pendingOperations())[0]?.payload).toMatchObject({ productId: "product-1" });
  });

  it("no vuelve a contar una operación ya confirmada", async () => {
    const operation = await enqueueOperation({ kind: "credit_movement", payload: { amount: 100 } });
    await markOperationSynced(operation.localId);

    expect(await pendingOperations()).toEqual([]);
    expect(await pendingOperationCount()).toBe(0);
  });

  it("conserva un catálogo para lectura sin conexión", async () => {
    await saveCatalogSnapshot([{ product_name: "Lentejas", sale_price: 2200 }]);

    await expect(loadCatalogSnapshot()).resolves.toMatchObject({
      rows: [{ product_name: "Lentejas", sale_price: 2200 }]
    });
  });
});
