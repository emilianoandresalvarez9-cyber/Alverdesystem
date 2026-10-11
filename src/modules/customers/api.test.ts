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

import { accountsLoadError, createCustomer } from "./api";

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
  beforeEach(() => {
    mocks.getSupabase.mockReset().mockReturnValue({ rpc: mocks.rpc });
    mocks.rpc.mockReset().mockResolvedValue({ error: null });
    mocks.allOperations.mockReset().mockResolvedValue([]);
    mocks.enqueueOperation.mockReset().mockResolvedValue({ localId: "customer-local-1" });
    mocks.markOperationFailed.mockReset().mockResolvedValue(undefined);
    mocks.markOperationSynced.mockReset().mockResolvedValue(undefined);
  });

  it("sincroniza datos normalizados con el RPC idempotente y espera su confirmación", async () => {
    await expect(createCustomer({ name: "  Mayra  ", phone: "  11 1234  ", creditLimit: 100_000 })).resolves.toBeUndefined();

    expect(mocks.enqueueOperation).toHaveBeenCalledWith({
      kind: "customer",
      payload: { name: "Mayra", phone: "11 1234", creditLimit: 100_000 }
    });
    expect(mocks.rpc).toHaveBeenCalledWith("sync_offline_customer", {
      p_id: "customer-local-1",
      p_name: "Mayra",
      p_phone: "11 1234",
      p_credit_limit: 100_000
    });
    expect(mocks.markOperationSynced).toHaveBeenCalledWith("customer-local-1");
  });

  it("reutiliza el localId pendiente en vez de crear otro cliente", async () => {
    mocks.allOperations.mockResolvedValueOnce([{
      localId: "existing-customer-id",
      kind: "customer",
      payload: { name: "Mayra", phone: "11 1234", creditLimit: 100_000 }
    }]);

    await createCustomer({ name: " Mayra ", phone: "11 1234", creditLimit: 100_000 });

    expect(mocks.enqueueOperation).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("sync_offline_customer", expect.objectContaining({ p_id: "existing-customer-id" }));
    expect(mocks.markOperationSynced).toHaveBeenCalledWith("existing-customer-id");
  });

  it("conserva la operación y no la marca sincronizada cuando Supabase rechaza el alta", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { code: "23503", message: "foreign key failure" } });

    await expect(createCustomer({ name: "Mayra" })).rejects.toThrow("No se pudo guardar el cliente: foreign key failure");

    expect(mocks.markOperationFailed).toHaveBeenCalledWith("customer-local-1", "foreign key failure", "23503", false);
    expect(mocks.markOperationSynced).not.toHaveBeenCalled();
  });

  it("rechaza nombre vacío y topes inválidos antes de encolar", async () => {
    await expect(createCustomer({ name: "  " })).rejects.toThrow("El nombre es obligatorio.");
    await expect(createCustomer({ name: "Mayra", creditLimit: Number.NaN })).rejects.toThrow("El tope de fiado");
    expect(mocks.allOperations).not.toHaveBeenCalled();
    expect(mocks.enqueueOperation).not.toHaveBeenCalled();
  });
});
