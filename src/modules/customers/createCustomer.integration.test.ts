import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Solo se simula Supabase. La cola (IndexedDB) y la sincronización son las reales.
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../shared/supabase/client", () => ({ getSupabase: () => ({ rpc }), SQL_NULL: null }));

const { createCustomer } = await import("./api");
const { submitNewCustomer } = await import("./submitCustomer");
const { pendingDeltas } = await import("./balance");
const { allOperations, enqueueOperation, markOperationFailed, pendingOperations, resetOfflineStorageForTests } =
  await import("../../shared/offline/queue");

const customerOps = async () => (await allOperations()).filter((operation) => operation.kind === "customer");

describe("Alta de cliente contra la cola real (RF-45, RF-35)", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
    rpc.mockReset().mockResolvedValue({ error: null });
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await resetOfflineStorageForTests();
  });

  it("éxito remoto: una sola operación, con el localId como ID remoto, marcada sincronizada recién tras la RPC", async () => {
    let syncedWhenRpcRan: boolean | undefined;
    rpc.mockImplementationOnce(async () => {
      syncedWhenRpcRan = !!(await customerOps())[0]?.syncedAt;
      return { error: null };
    });

    const localId = await createCustomer({ name: "Mayra", phone: "11 1234" });

    expect(syncedWhenRpcRan).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("sync_offline_customer", expect.objectContaining({ p_id: localId, p_name: "Mayra" }));
    const operations = await customerOps();
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({ localId });
    expect(operations[0]?.syncedAt).toBeTruthy();
  });

  it("error de Supabase: la operación queda pendiente y rechazada, no sincronizada ni borrada", async () => {
    rpc.mockResolvedValueOnce({ error: { code: "42501", message: "permission denied" } });

    await expect(createCustomer({ name: "Mayra" })).rejects.toMatchObject({ name: "CustomerCreateError" });

    const [operation] = await customerOps();
    expect(operation?.syncedAt).toBeUndefined();
    expect(operation).toMatchObject({ retryable: false, failureCode: "42501", failureMessage: "permission denied" });
    expect(await pendingOperations()).toHaveLength(1);
  });

  it("reintento tras un fallo conserva el mismo localId y no crea una segunda operación", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "Failed to fetch" } });
    const first = await submitNewCustomer({ name: "Mayra", phone: "", limit: "" }, false);
    expect(first.status).toBe("failed");
    const retryLocalId = first.status === "failed" ? first.retryLocalId : undefined;
    expect(retryLocalId).toBeTruthy();

    const second = await submitNewCustomer({ name: "Mayra", phone: "", limit: "" }, false, retryLocalId);

    expect(second).toEqual({ status: "created", localId: retryLocalId });
    const operations = await customerOps();
    expect(operations).toHaveLength(1);
    expect(operations[0]?.syncedAt).toBeTruthy();
    expect(operations[0]?.failureMessage).toBeUndefined();
  });

  it("un cliente ya pendiente conserva su localId y los movimientos siguen apuntando a él", async () => {
    const pending = await enqueueOperation({ kind: "customer", payload: { name: "Mayra", phone: null, creditLimit: null } });
    const movement = await enqueueOperation({
      kind: "credit_movement",
      payload: { customerId: pending.localId, movementKind: "charge", amount: 1500 }
    });

    const localId = await createCustomer({ name: "Mayra" });

    expect(localId).toBe(pending.localId);
    expect(await customerOps()).toHaveLength(1);
    const stored = (await allOperations()).find((operation) => operation.localId === movement.localId);
    expect((stored?.payload as { customerId: string }).customerId).toBe(pending.localId);
    expect(stored?.syncedAt).toBeUndefined();
    expect(pendingDeltas(await allOperations()).deltas.get(pending.localId)).toBe(1500);
  });

  it("rechaza un tope que excede numeric(14,2) antes de encolar ni llamar a la RPC (causa de Mayra: 22003)", async () => {
    await expect(createCustomer({ name: "Mayra", creditLimit: 10_000_000_000_000 })).rejects.toThrow("demasiado alto");
    expect(rpc).not.toHaveBeenCalled();
    expect(await allOperations()).toHaveLength(0);
    await expect(createCustomer({ name: "Mayra", creditLimit: 999_999_999_999.99 })).resolves.toBeTruthy();
  });

  it("un 22003 del servidor queda como rechazo permanente (no reintenta en bucle)", async () => {
    rpc.mockResolvedValueOnce({ error: { code: "22003", message: "numeric field overflow" } });
    await expect(createCustomer({ name: "Mayra", creditLimit: 5 })).rejects.toBeTruthy();
    expect((await customerOps())[0]).toMatchObject({ retryable: false, failureCode: "22003" });
  });

  it("enviar el alta no sincroniza ventas ni movimientos pendientes ni reintenta rechazados", async () => {
    const sale = await enqueueOperation({ kind: "sale", payload: { shiftId: "s1" } });
    const rejected = await enqueueOperation({ kind: "credit_movement", payload: { customerId: "ya-no-existe", amount: 10 } });
    await markOperationFailed(rejected.localId, 'violates foreign key constraint "credit_movements_customer_id_fkey"', "23503", false);

    await createCustomer({ name: "Mayra" });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[0]).toBe("sync_offline_customer");
    const operations = await allOperations();
    expect(operations.find((operation) => operation.localId === sale.localId)?.syncedAt).toBeUndefined();
    const kept = operations.find((operation) => operation.localId === rejected.localId);
    expect(kept).toMatchObject({ retryable: false, failureCode: "23503", payload: { customerId: "ya-no-existe", amount: 10 } });
    expect(kept?.syncedAt).toBeUndefined();
  });
});

describe("Formulario Nuevo cliente: cuándo se cierra el modal", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
    rpc.mockReset().mockResolvedValue({ error: null });
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await resetOfflineStorageForTests();
  });

  it("se cierra (status created) solo después de que la RPC responde sin error", async () => {
    let resolveRpc: (value: { error: null }) => void = () => undefined;
    rpc.mockReturnValueOnce(new Promise((resolve) => { resolveRpc = resolve; }));

    let settled = false;
    const outcome = submitNewCustomer({ name: "Mayra", phone: "", limit: "" }, false).then((value) => { settled = true; return value; });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);

    resolveRpc({ error: null });
    expect((await outcome).status).toBe("created");
  });

  it("con error de Supabase no se cierra: devuelve el mensaje y el ID para reintentar", async () => {
    rpc.mockResolvedValueOnce({ error: { code: "23503", message: "fk violada" } });

    const outcome = await submitNewCustomer({ name: "Mayra", phone: "", limit: "" }, false);

    expect(outcome).toMatchObject({ status: "failed", message: "No se pudo guardar el cliente: fk violada" });
    expect(outcome.status === "failed" && outcome.retryLocalId).toBeTruthy();
  });

  it("RF-47: el empleado no envía tope aunque lo escriba; la administradora sí", async () => {
    await submitNewCustomer({ name: "Ana", phone: "", limit: "5000" }, false);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_credit_limit: null });

    await submitNewCustomer({ name: "Beto", phone: "", limit: "5000,5" }, true);
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({ p_credit_limit: 5000.5 });
  });
});
