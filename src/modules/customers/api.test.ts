import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
  rpc: vi.fn(),
  allOperations: vi.fn(),
  enqueueOperation: vi.fn(),
  markOperationFailed: vi.fn(),
  markOperationSynced: vi.fn()
}));
vi.mock("../../shared/supabase/client", () => ({
  getSupabase: mocks.getSupabase,
  SQL_NULL: { __sqlNull: true }
}));
vi.mock("../../shared/offline/queue", () => ({
  allOperations: mocks.allOperations,
  enqueueOperation: mocks.enqueueOperation,
  markOperationFailed: mocks.markOperationFailed,
  markOperationSynced: mocks.markOperationSynced,
  readSetting: vi.fn(),
  writeSetting: vi.fn()
}));
vi.mock("../../shared/offline/sync", () => ({
  isPermanentSyncError: (code?: string) => !!code && code.startsWith("23"),
  synchronizePendingOperations: vi.fn()
}));

import { accountsLoadError, createCustomer, CustomerCreateError } from "./api";

describe("Clientes: el error dice la causa real", () => {
  it("sin conexión y sin copia: pide conectarse", () => {
    expect(accountsLoadError(false, new Error("Failed to fetch")).message).toMatch(/^Sin conexión/);
  });

  it("con conexión: muestra el motivo (p. ej. un permiso de la base), no 'Sin conexión'", () => {
    const message = accountsLoadError(true, { message: "permission denied for function credit_movement_delta" }).message;
    expect(message).not.toMatch(/Sin conexión/);
    expect(message).toContain("permission denied for function credit_movement_delta");
  });
});

describe("Clientes: alta confirmada por Supabase", () => {
  const input = { name: "Mayra", phone: "11 1234", creditLimit: 100_000 };

  beforeEach(() => {
    mocks.getSupabase.mockReset().mockReturnValue({ rpc: mocks.rpc });
    mocks.rpc.mockReset().mockResolvedValue({ error: null });
    mocks.allOperations.mockReset().mockResolvedValue([]);
    mocks.enqueueOperation.mockReset().mockResolvedValue({ localId: "customer-local-1" });
    mocks.markOperationFailed.mockReset().mockResolvedValue(undefined);
    mocks.markOperationSynced.mockReset().mockResolvedValue(undefined);
  });

  it("normaliza datos, encola y espera la RPC antes de marcar sincronizado", async () => {
    await expect(createCustomer({ ...input, name: "  Mayra  ", phone: "  11 1234  " })).resolves.toBe("customer-local-1");

    expect(mocks.enqueueOperation).toHaveBeenCalledWith({
      kind: "customer",
      payload: input
    });
    expect(mocks.rpc).toHaveBeenCalledWith("sync_offline_customer", {
      p_id: "customer-local-1",
      p_name: "Mayra",
      p_phone: "11 1234",
      p_credit_limit: 100_000
    });
    expect(mocks.markOperationSynced).toHaveBeenCalledWith("customer-local-1");
  });

  it("reutiliza un alta pendiente equivalente en vez de generar otro ID", async () => {
    mocks.allOperations.mockResolvedValueOnce([{
      localId: "existing-customer-id",
      kind: "customer",
      payload: input
    }]);

    await createCustomer(input);

    expect(mocks.enqueueOperation).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("sync_offline_customer", expect.objectContaining({ p_id: "existing-customer-id" }));
    expect(mocks.markOperationSynced).toHaveBeenCalledWith("existing-customer-id");
  });

  it("al reintentar conserva el ID aunque la sincronización de fondo ya la marcó", async () => {
    mocks.allOperations.mockResolvedValueOnce([{
      localId: "existing-customer-id",
      kind: "customer",
      payload: input,
      syncedAt: "2026-10-11T00:00:00.000Z"
    }]);

    await createCustomer(input, "existing-customer-id");

    expect(mocks.enqueueOperation).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("sync_offline_customer", expect.objectContaining({ p_id: "existing-customer-id" }));
  });

  it("conserva el ID y no marca sincronizado si Supabase rechaza el alta", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { code: "23503", message: "foreign key failure" } });

    const result = createCustomer(input);
    await expect(result).rejects.toMatchObject({
      name: "CustomerCreateError",
      localId: "customer-local-1",
      message: "No se pudo guardar el cliente: foreign key failure"
    });
    expect(mocks.markOperationFailed).toHaveBeenCalledWith("customer-local-1", "foreign key failure", "23503", false);
    expect(mocks.markOperationSynced).not.toHaveBeenCalled();
  });

  it("rechaza nombre vacío y topes inválidos antes de encolar", async () => {
    await expect(createCustomer({ name: "  " })).rejects.toThrow("El nombre es obligatorio.");
    await expect(createCustomer({ name: "Mayra", creditLimit: Number.NaN })).rejects.toThrow("El tope de fiado");
    expect(mocks.allOperations).not.toHaveBeenCalled();
    expect(mocks.enqueueOperation).not.toHaveBeenCalled();
  });

  it("usa un tipo de error que permite a la pantalla reintentar con el mismo ID", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "sin conexión" } });
    await expect(createCustomer(input)).rejects.toBeInstanceOf(CustomerCreateError);
  });
});
