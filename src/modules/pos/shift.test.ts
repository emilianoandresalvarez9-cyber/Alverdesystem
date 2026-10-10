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

const { currentShift, openShift } = await import("./shift");
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
    expect((await currentShift())?.initialBalance).toBe(5000);
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
    await openShift(register, 0);
    expect((await currentShift())?.persisted).toBe(true);
  });
});
