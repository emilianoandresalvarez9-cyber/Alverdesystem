import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, insert } = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn() }));
vi.mock("../../shared/supabase/client", () => ({ getSupabase: () => ({ from }) }));

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
    from.mockReset().mockReturnValue({ insert });
    insert.mockReset().mockResolvedValue({ error: null });
  });

  it("inserta datos normalizados en la base y espera la respuesta", async () => {
    await expect(createCustomer({ name: "  Mayra  ", phone: "  11 1234  ", creditLimit: 100_000 })).resolves.toBeUndefined();

    expect(from).toHaveBeenCalledWith("customers");
    expect(insert).toHaveBeenCalledWith({
      name: "Mayra",
      phone: "11 1234",
      credit_limit: 100_000
    });
  });

  it("no confirma el alta si Supabase rechaza el guardado", async () => {
    insert.mockResolvedValueOnce({ error: { message: "permission denied" } });

    await expect(createCustomer({ name: "Mayra" })).rejects.toThrow("No se pudo guardar el cliente: permission denied");
  });

  it("rechaza nombre vacío y topes inválidos antes de llamar a Supabase", async () => {
    await expect(createCustomer({ name: "  " })).rejects.toThrow("El nombre es obligatorio.");
    await expect(createCustomer({ name: "Mayra", creditLimit: Number.NaN })).rejects.toThrow("El tope de fiado");
    expect(from).not.toHaveBeenCalled();
  });
});
