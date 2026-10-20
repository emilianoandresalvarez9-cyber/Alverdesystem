import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../supabase/client", () => ({ getSupabase: () => ({ rpc }) }));

const { isPermanentSyncError, synchronizePendingOperations } = await import("./sync");
const { enqueueOperation, pendingOperations, resetOfflineStorageForTests } = await import("./queue");

describe("offline sync", () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    rpc.mockReset();
    await resetOfflineStorageForTests();
  });

  it("classifies integrity, permission, and schema errors as permanent", () => {
    expect(isPermanentSyncError("23503")).toBe(true);
    expect(isPermanentSyncError("23505")).toBe(true);
    expect(isPermanentSyncError("42501")).toBe(true);
    expect(isPermanentSyncError("42P01")).toBe(true);
    expect(isPermanentSyncError("42703")).toBe(true);
  });

  it("classifies data exceptions (class 22, e.g. numeric overflow) as permanent, not endless retries", () => {
    expect(isPermanentSyncError("22003")).toBe(true);
    expect(isPermanentSyncError("22P02")).toBe(true);
  });

  it("keeps network and transient server errors retryable", () => {
    expect(isPermanentSyncError(undefined)).toBe(false);
    expect(isPermanentSyncError("08006")).toBe(false);
    expect(isPermanentSyncError("57014")).toBe(false);
    expect(isPermanentSyncError("PGRST000")).toBe(false);
  });

  it("keeps an FK-rejected sale and stops retrying it until an explicit retry", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const operation = await enqueueOperation({ kind: "sale", payload: { shiftId: "shift-1" } });
    rpc.mockResolvedValueOnce({ error: { code: "23503", message: "customer does not exist" } });

    const first = await synchronizePendingOperations();
    expect(first).toMatchObject({ synchronized: 0, failed: 1, rejected: 1 });
    expect((await pendingOperations())[0]).toMatchObject({
      localId: operation.localId,
      retryable: false,
      failureCode: "23503",
      failureMessage: "customer does not exist"
    });

    await synchronizePendingOperations();
    expect(rpc).toHaveBeenCalledTimes(1);

    rpc.mockResolvedValueOnce({ error: null });
    const retried = await synchronizePendingOperations({ retryRejected: true });
    expect(retried).toMatchObject({ synchronized: 1, failed: 0, rejected: 0 });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(await pendingOperations()).toEqual([]);
  });

  /** La primera llamada a la nube queda esperando hasta `release()`; las demás responden enseguida. */
  function slowFirstCall() {
    let release = () => {};
    rpc.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ error: null }); }));
    rpc.mockResolvedValue({ error: null });
    return () => release();
  }

  it("RF-35: lo que se encola mientras otra sincronización está en curso se envía al terminar, sin esperar otro evento", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const release = slowFirstCall();
    await enqueueOperation({ kind: "sale", payload: { shiftId: "shift-1", n: 1 } });
    const running = synchronizePendingOperations();
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));

    // Se cobran dos ventas más mientras la primera todavía se está enviando.
    await enqueueOperation({ kind: "sale", payload: { shiftId: "shift-1", n: 2 } });
    const second = synchronizePendingOperations();
    await enqueueOperation({ kind: "sale", payload: { shiftId: "shift-1", n: 3 } });
    const third = synchronizePendingOperations();

    release();
    expect(await running).toMatchObject({ synchronized: 1, failed: 0 });
    expect(await second).toMatchObject({ synchronized: 2, failed: 0 });
    expect(await third).toMatchObject({ synchronized: 2, failed: 0 });
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(await pendingOperations()).toEqual([]);
  });

  it("un reintento explícito de rechazadas pedido durante una sincronización se hace al terminar (cierre de turno)", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const rejected = await enqueueOperation({ kind: "sale", payload: { shiftId: "shift-1" } });
    rpc.mockResolvedValueOnce({ error: { code: "23503", message: "customer does not exist" } });
    await synchronizePendingOperations();
    rpc.mockReset();

    const release = slowFirstCall();
    await enqueueOperation({ kind: "stock_movement", payload: { action: "quick_restock" } });
    const running = synchronizePendingOperations();
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));

    const closing = synchronizePendingOperations({ retryRejected: true });
    release();
    await running;
    expect(await closing).toMatchObject({ synchronized: 1, failed: 0, rejected: 0 });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({ payload: { localId: rejected.localId } });
    expect(await pendingOperations()).toEqual([]);
  });
});
