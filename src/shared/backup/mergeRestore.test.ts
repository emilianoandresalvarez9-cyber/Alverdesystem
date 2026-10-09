import "fake-indexeddb/auto";
import { readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { BackupService } from "./backupService";
import { TABLES_TO_BACKUP } from "./export";
import { enqueueOperation, pendingOperations, readSetting, resetOfflineStorageForTests, writeSetting } from "../offline/queue";

describe("recuperar operaciones desde un respaldo (T-09) sin perder las del equipo", () => {
  afterEach(async () => {
    await resetOfflineStorageForTests();
  });

  it("agrega lo que falta, no pisa lo existente y no toca las preferencias", async () => {
    const service = new BackupService();
    const enRespaldo = await enqueueOperation({ kind: "sale", payload: { totalAmount: 100 } });
    await writeSetting("pos-register", { id: "caja-1" });
    const respaldo = JSON.stringify(await service.extractData());

    // Después del respaldo el equipo pierde la cola y hace una venta nueva sin enviar.
    await resetOfflineStorageForTests();
    const nueva = await enqueueOperation({ kind: "sale", payload: { totalAmount: 250 } });
    await writeSetting("pos-register", { id: "caja-2" });

    expect(await service.mergePendingOperations(respaldo)).toEqual({ added: 1, skipped: 0 });
    const ids = (await pendingOperations()).map((o) => o.localId).sort();
    expect(ids).toEqual([enRespaldo.localId, nueva.localId].sort()); // la venta nueva sigue ahí
    expect(await readSetting("pos-register")).toEqual({ id: "caja-2" }); // la caja asignada no se pisa

    // Recuperar dos veces el mismo archivo no duplica.
    expect(await service.mergePendingOperations(respaldo)).toEqual({ added: 0, skipped: 1 });
  });

  it("rechaza archivos que no son respaldos", async () => {
    await enqueueOperation({ kind: "sale", payload: {} });
    await expect(new BackupService().mergePendingOperations("no es json")).rejects.toThrow(/JSON/);
    await expect(new BackupService().mergePendingOperations('{"data":{}}')).rejects.toThrow(/operaciones/);
  });
});

describe("copia completa (RF-41)", () => {
  it("incluye todas las tablas que crean las migraciones", () => {
    const dir = "supabase/migrations";
    const sql = readdirSync(dir).map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n").toLowerCase();
    const created = new Set([...sql.matchAll(/create table (?:if not exists )?public\.([a-z_]+)/g)].map((m) => m[1] ?? ""));
    const dropped = new Set([...sql.matchAll(/drop table (?:if exists )?public\.([a-z_]+)/g)].map((m) => m[1] ?? ""));
    const tables = [...created].filter((t) => !dropped.has(t)).sort();
    const missing = tables.filter((t) => !(TABLES_TO_BACKUP as readonly string[]).includes(t));
    expect(missing, `Tablas sin respaldar: ${missing.join(", ")}`).toEqual([]);
  });
});
