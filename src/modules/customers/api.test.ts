import { describe, expect, it } from "vitest";
import { accountsLoadError } from "./api";

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
