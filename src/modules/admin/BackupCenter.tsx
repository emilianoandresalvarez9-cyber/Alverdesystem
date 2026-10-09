import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button, GlassCard } from "../../shared/ui";
import { backupService } from "../../shared/backup/backupService";
import { downloadFile, generateFullBackup, jsonToCSV, saveBackupToDisk } from "../../shared/backup/export";
import { chooseBackupDirectory, tryWritePendingOperationsBackup } from "../../shared/offline/backup";
import { pendingOperations } from "../../shared/offline/queue";
import { synchronizePendingOperations } from "../../shared/offline/sync";
import { getSupabase } from "../../shared/supabase/client";

const CSV_TABLES: { table: string; label: string }[] = [
  { table: "products", label: "Productos" },
  { table: "product_presentations", label: "Presentaciones" },
  { table: "stock_lots", label: "Lotes" },
  { table: "customers", label: "Clientes" },
  { table: "credit_movements", label: "Movimientos de fiado" },
  { table: "sales", label: "Ventas" },
  { table: "sale_items", label: "Ítems de venta" },
  { table: "suppliers", label: "Proveedores" },
  { table: "audit_history", label: "Historial de cambios" }
];

type Message = { tone: "ok" | "error"; text: string } | null;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Respaldos en un solo lugar (RF-40 a RF-44). Reemplaza a BackupSettings + BackupManager, que
 * duplicaban la copia completa y la exportación, y tenían una "restauración" que escribía sobre la
 * base desde el navegador, tabla por tabla y sin transacción (P17).
 */
export function BackupCenter() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(context: string, action: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ tone: "ok", text: await action() });
    } catch (error) {
      console.error(context, error);
      setMessage({ tone: "error", text: `${context}: ${errorText(error)}` });
    } finally {
      setBusy(false);
    }
  }

  const chooseFolder = () => run("No se pudo activar la segunda copia", async () => {
    await chooseBackupDirectory();
    const result = await tryWritePendingOperationsBackup(await pendingOperations());
    return result === "written"
      ? "Segunda copia activada: las ventas pendientes también se guardan en esa carpeta."
      : "La carpeta quedó elegida, pero el navegador necesita permiso de escritura. Volvé a intentarlo.";
  });

  const recoverPending = (file: File) => run("No se pudieron recuperar las operaciones", async () => {
    const { added, skipped } = await backupService.mergePendingOperations(await file.text());
    void synchronizePendingOperations().catch(() => undefined);
    return added === 0
      ? `No había nada nuevo para recuperar (${skipped} operación(es) ya estaban en este equipo).`
      : `Se recuperaron ${added} operación(es). Se envían a la nube apenas haya conexión.`;
  });

  const downloadFull = () => run("No se pudo generar la copia completa", async () => {
    if (!(await saveBackupToDisk(await generateFullBackup()))) throw new Error("no se pudo escribir el archivo");
    return "Copia completa descargada. Guardala fuera de la notebook.";
  });

  const exportCsv = (table: string, label: string) => run(`No se pudo exportar ${label}`, async () => {
    // La tabla llega por nombre en tiempo de ejecución: cliente sin tipos de tabla, solo para exportar.
    const exporter = getSupabase() as unknown as SupabaseClient;
    const { data, error } = await exporter.from(table).select("*");
    if (error) throw error;
    downloadFile(jsonToCSV(data ?? []), `alverde-${table}.csv`, "text/csv");
    return `${label} exportado.`;
  });

  return (
    <div className="pos-setup" style={{ maxWidth: "none", gridColumn: "1 / -1" }}>
      <GlassCard className="pos-panel">
        <h2 style={{ marginTop: 0 }}>Ventas pendientes de este equipo</h2>
        <p className="field-help">
          Las ventas hechas sin conexión viven en este equipo hasta que se envían. Elegí una carpeta (puede ser
          la de Google Drive o un pendrive) para guardar una segunda copia automática.
        </p>
        <div className="pos-qty" style={{ flexWrap: "wrap" }}>
          <Button variant="secundario" onClick={() => void chooseFolder()} disabled={busy}>Elegir carpeta para la segunda copia</Button>
          <Button variant="fantasma" onClick={() => fileRef.current?.click()} disabled={busy}>Recuperar desde un respaldo…</Button>
          <input ref={fileRef} type="file" accept="application/json" hidden
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void recoverPending(file); e.target.value = ""; }} />
        </div>
        <p className="field-help">Recuperar no borra nada: solo agrega las operaciones que falten en este equipo.</p>
      </GlassCard>

      <GlassCard className="pos-panel">
        <h2 style={{ marginTop: 0 }}>Copia completa de la base</h2>
        <p className="field-help">
          Descarga todos los datos del negocio en un archivo. Para <strong>restaurar</strong> la base se sigue
          el procedimiento de <code>docs/runbooks/restaurar-base.md</code>: no se hace desde el navegador porque
          pisaría los datos actuales sin poder deshacerlo.
        </p>
        <Button onClick={() => void downloadFull()} loading={busy}>Descargar copia completa</Button>
      </GlassCard>

      <GlassCard className="pos-panel">
        <h2 style={{ marginTop: 0 }}>Exportar a Excel (CSV)</h2>
        <div className="pos-qty" style={{ flexWrap: "wrap" }}>
          {CSV_TABLES.map(({ table, label }) => (
            <Button key={table} variant="secundario" onClick={() => void exportCsv(table, label)} disabled={busy}>{label}</Button>
          ))}
        </div>
      </GlassCard>

      <p className="pos-feedback" data-tone={message?.tone} role={message?.tone === "error" ? "alert" : "status"}>{message?.text}</p>
    </div>
  );
}
