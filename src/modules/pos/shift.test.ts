import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetOfflineStorageForTests } from "../../shared/offline/queue";

// Cliente de Supabase simulado: sólo lo que usa openShift (buscar un turno propio abierto y crearlo).
const upsert = vi.fn();
vi.mock("../../shared/supabase/client", () => {
  const query = { eq: () => query, maybeSingle: async () => ({ data: null, error: null }) };
  return {
    getSupabase: () => ({
      auth: { getUser: async () => ({ data: { user: { id: "cajera" } } }) },
      from: () => ({ select: () => query, upsert })
    })
  };
});

const { closeShift, currentShift, openShift, persistShift } = await import("./shift");
const register = { id: "c9", name: "Caja Norte", branchName: "Norte", branchId: "norte" };

describe("abrir turno (RF-66)", () => {
  beforeEach(() => {
    upsert.mockReset();
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await resetOfflineStorageForTests();
  });

  it("si la base rechaza el turno (caja de otra sucursal), avisa y el equipo no queda trabado con él", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    upsert.mockResolvedValue({
      error: { code: "42501", message: "Caja Norte es de la sucursal Norte, y tu usuario trabaja en otra." }
    });
    await expect(openShift(register, 0, "cajera")).rejects.toThrow(/Caja Norte es de la sucursal Norte/);
    expect(await currentShift("cajera")).toBeUndefined();
  });

  it("sin conexión el turno se abre igual en el equipo, para seguir vendiendo", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const shift = await openShift(register, 5000, "cajera");
    expect(shift.persisted).toBe(false);
    expect((await currentShift("cajera"))?.initialBalance).toBe(5000);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("no comparte el turno local con otra cuenta del mismo equipo", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await openShift(register, 5000, "cajera");
    expect(await currentShift("otra-cajera")).toBeUndefined();
    expect((await currentShift("cajera"))?.ownerUserId).toBe("cajera");
  });

  it("con conexión y la base de acuerdo, queda registrado", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    upsert.mockResolvedValue({ error: null });
    await openShift(register, 0, "cajera");
    expect((await currentShift("cajera"))?.persisted).toBe(true);
  });

  it("A-04: si un turno abierto sin conexión es rechazado al volver la red, guarda persistError y closeShift muestra ese motivo", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await openShift(register, 2000, "cajera");

    vi.stubGlobal("navigator", { onLine: true });
    upsert.mockResolvedValue({
      error: { code: "23505", message: "duplicate key value violates unique constraint" }
    });

    await expect(persistShift()).rejects.toThrow(/ya tiene un turno abierto de otra persona/);
    const stored = await currentShift("cajera");
    expect(stored?.persisted).toBe(false);
    expect(stored?.persistError).toMatch(/ya tiene un turno abierto de otra persona/);

    const outcome = await closeShift("cajera");
    expect(outcome.closed).toBe(false);
    if (!outcome.closed) {
      expect(outcome.reason).toMatch(/ya tiene un turno abierto de otra persona/);
      expect(outcome.reason).not.toMatch(/hace falta conexión/);
    }
  });
});

