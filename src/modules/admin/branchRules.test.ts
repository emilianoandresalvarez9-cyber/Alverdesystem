import { describe, expect, it } from "vitest";
import { describeBranchError, mainBranch, runAndReload } from "./branchRules";

const branch = (id: string, name: string, created_at: string, archived_at: string | null = null) => ({ id, name, created_at, archived_at });

describe("mainBranch (D-01): la misma sucursal principal que la base", () => {
  it("es la más antigua, no la primera por nombre", () => {
    const branches = [branch("b2", "Almagro", "2026-10-01T00:00:00Z"), branch("b1", "Centro", "2026-09-01T00:00:00Z")];
    expect(mainBranch(branches)?.name).toBe("Centro");
  });

  it("no cuenta las archivadas y desempata por id", () => {
    const branches = [
      branch("b0", "Vieja", "2020-01-01T00:00:00Z", "2026-01-01T00:00:00Z"),
      branch("b3", "Norte", "2026-09-01T00:00:00Z"),
      branch("b2", "Sur", "2026-09-01T00:00:00Z")
    ];
    expect(mainBranch(branches)?.name).toBe("Sur");
    expect(mainBranch([])).toBeUndefined();
  });
});

describe("describeBranchError", () => {
  it("el nombre repetido (23505) se explica en castellano", () => {
    expect(describeBranchError({ code: "23505", message: 'duplicate key value violates unique constraint "registers_branch_id_name_key"' }))
      .toBe("Ya hay una con ese nombre. Elegí otro nombre.");
  });
  it("otros errores conservan su mensaje", () => {
    expect(describeBranchError({ code: "42501", message: "Sin permiso." })).toBe("Sin permiso.");
  });
});

describe("runAndReload (D-01): el error de la acción no se borra al recargar", () => {
  it("recarga primero y devuelve el error después", async () => {
    const log: string[] = [];
    const message = await runAndReload(
      async () => { log.push("accion"); return { error: { code: "23505", message: "duplicate key" } }; },
      async () => { log.push("recarga"); }
    );
    log.push(`mensaje: ${message}`);
    expect(log).toEqual(["accion", "recarga", "mensaje: Ya hay una con ese nombre. Elegí otro nombre."]);
  });

  it("sin error recarga y no devuelve mensaje", async () => {
    let reloaded = 0;
    expect(await runAndReload(async () => ({ error: null }), async () => { reloaded += 1; })).toBeNull();
    expect(reloaded).toBe(1);
  });
});
