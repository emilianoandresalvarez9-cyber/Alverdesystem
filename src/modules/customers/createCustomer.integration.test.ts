import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Solo se simula Supabase. La cola (IndexedDB) y la sincronización son las reales.
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("../../shared/supabase/client", () => ({ getSupabase: () => ({ rpc, from }), SQL_NULL: null }));

const { createCustomer, setCreditLimit } = await import("./api");
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
    rpc
      .mockResolvedValueOnce({ error: { message: "Failed to fetch" } }) // 1.º intento: falla
      .mockResolvedValueOnce({ error: null });                          // 2.º intento: Supabase acepta
    const first = await submitNewCustomer({ name: "Mayra", phone: "", limit: "" }, false);
    expect(first.status).toBe("failed");
    const retryLocalId = first.status === "failed" ? first.retryLocalId : undefined;
    expect(retryLocalId).toBeTruthy();

    const second = await submitNewCustomer({ name: "Mayra", phone: "", limit: "" }, false, retryLocalId);

    expect(second).toEqual({ status: "created", localId: retryLocalId });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map((call) => (call[1] as { p_id: string }).p_id)).toEqual([retryLocalId, retryLocalId]);
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

  it("un dato inválido se rechaza antes de crear nada: sin operación, sin RPC y sin retryLocalId (no hay qué reintentar)", async () => {
    const outcome = await submitNewCustomer({ name: "Mayra", phone: "", limit: "10000000000000" }, true);

    expect(outcome).toEqual({ status: "failed", message: expect.stringContaining("demasiado alto") });
    expect(rpc).not.toHaveBeenCalled();
    expect(await allOperations()).toHaveLength(0);
  });

  it("RF-47: el empleado no envía tope aunque lo escriba; la administradora sí", async () => {
    await submitNewCustomer({ name: "Ana", phone: "", limit: "5000" }, false);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_credit_limit: null });

    await submitNewCustomer({ name: "Beto", phone: "", limit: "5000,5" }, true);
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({ p_credit_limit: 5000.5 });
  });
});

describe("Corrección del tope de un alta pendiente (caso Mayra: 22003 + movimiento con FK)", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
    rpc.mockReset().mockResolvedValue({ error: null });
    from.mockReset();
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await resetOfflineStorageForTests();
  });

  async function seedMayra() {
    const customer = await enqueueOperation({ kind: "customer", payload: { name: "Mayra", phone: "1135118442", creditLimit: 10_000_000_000_000 } });
    await markOperationFailed(customer.localId, "numeric field overflow", "22003", true);
    const movement = await enqueueOperation({
      kind: "credit_movement",
      payload: { customerId: customer.localId, movementKind: "payment", amount: 10, note: "prueba" }
    });
    await markOperationFailed(movement.localId, 'violates foreign key constraint "credit_movements_customer_id_fkey"', "23503", false);
    return { customer, movement };
  }

  it("corrige solo el tope, conserva localId, deja registro, envía solo esa alta y no toca el movimiento", async () => {
    const { customer, movement } = await seedMayra();

    await expect(setCreditLimit(customer.localId, 500_000)).resolves.toBe("customer_created");

    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("sync_offline_customer", {
      p_id: customer.localId, p_name: "Mayra", p_phone: "1135118442", p_credit_limit: 500_000
    });
    const operations = await allOperations();
    expect(operations).toHaveLength(2);
    const fixed = operations.find((operation) => operation.localId === customer.localId);
    expect(fixed?.syncedAt).toBeTruthy();
    expect(fixed?.payload).toMatchObject({
      name: "Mayra", phone: "1135118442", creditLimit: 500_000,
      corrections: [{ field: "creditLimit", previous: 10_000_000_000_000 }]
    });
    const untouched = operations.find((operation) => operation.localId === movement.localId);
    expect(untouched).toMatchObject({ retryable: false, failureCode: "23503", payload: { customerId: customer.localId, amount: 10 } });
    expect(untouched?.syncedAt).toBeUndefined();
  });

  it("acepta 'sin tope' (null)", async () => {
    const { customer } = await seedMayra();
    await setCreditLimit(customer.localId, null);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_id: customer.localId, p_credit_limit: null });
  });

  it("un tope que sigue siendo inválido se rechaza sin modificar la operación ni llamar a la RPC", async () => {
    const { customer } = await seedMayra();
    await expect(setCreditLimit(customer.localId, 10_000_000_000_000)).rejects.toThrow("demasiado alto");
    expect(rpc).not.toHaveBeenCalled();
    const stored = (await customerOps())[0];
    expect(stored?.payload).toMatchObject({ creditLimit: 10_000_000_000_000 });
    expect(stored?.syncedAt).toBeUndefined();
  });

  it("si Supabase rechaza la corrección, el alta sigue pendiente con el mismo localId y el error visible", async () => {
    const { customer } = await seedMayra();
    rpc.mockResolvedValueOnce({ error: { code: "42501", message: "Solo la administradora define el tope de fiado (RF-47)." } });

    await expect(setCreditLimit(customer.localId, 1000)).rejects.toMatchObject({ localId: customer.localId });

    const stored = (await customerOps())[0];
    expect(stored).toMatchObject({ localId: customer.localId, retryable: false, failureCode: "42501" });
    expect(stored?.syncedAt).toBeUndefined();
  });

  it("cliente ya en la nube: actualiza por ID; si no actualiza ninguna fila, lo informa en vez de fingir éxito", async () => {
    const select = vi.fn().mockResolvedValueOnce({ data: [{ id: "c1" }], error: null }).mockResolvedValueOnce({ data: [], error: null });
    from.mockReturnValue({ update: () => ({ eq: () => ({ select }) }) });

    await expect(setCreditLimit("c1", 2000)).resolves.toBe("updated");
    await expect(setCreditLimit("c1", 2000)).rejects.toThrow("No se encontró al cliente en la nube");
    expect(rpc).not.toHaveBeenCalled();
  });
});
