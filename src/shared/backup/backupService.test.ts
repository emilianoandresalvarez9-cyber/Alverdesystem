import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { BackupService } from "./backupService";
import { enqueueOperation, resetOfflineStorageForTests } from "../offline/queue";

describe("BackupService (RF-41)", () => {
  afterEach(async () => {
    await resetOfflineStorageForTests();
  });

  it("el respaldo por defecto incluye las operaciones pendientes reales", async () => {
    const operation = await enqueueOperation({ kind: "sale", payload: { total: 1500 } });

    const backup = await new BackupService().extractData();
    const operations = backup.data["operations"] as Array<{ localId: string }> | undefined;

    expect(operations?.map((o) => o.localId)).toContain(operation.localId);
  });
});
