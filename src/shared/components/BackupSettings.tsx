import { useState } from "react";
import { chooseBackupDirectory } from "../offline/backup";
import { pendingOperations } from "../offline/queue";
import { tryWritePendingOperationsBackup } from "../offline/backup";
import { generateFullBackup, saveBackupToDisk, jsonToCSV, downloadFile } from "../backup/export";
import { Button } from "../ui";
import { backupService } from "../backup/backupService";
import { useRef } from "react";

import { useCurrentProfile } from '../auth/AuthGate';

export function BackupSettings() {
  const { role } = useCurrentProfile();
  const [message, setMessage] = useState("Aún no se eligió una carpeta de respaldo para la cola offline.");
  const [backupLoading, setBackupLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  async function handleRestoreOfflineBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage("Leyendo archivo de respaldo offline...");
    try {
      const text = await file.text();
      await backupService.restoreData(text);
      setMessage("Respaldo offline restaurado correctamente. Recargue la página si es necesario.");
    } catch (error: unknown) {
      setMessage("Error al restaurar: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function enableBackup() {
    try {
      await chooseBackupDirectory();
      const result = await tryWritePendingOperationsBackup(await pendingOperations());
      setMessage(result === "written"
        ? "Respaldo local habilitado. Las operaciones pendientes se actualizarán automáticamente."
        : "La carpeta se guardó, pero el navegador necesita permiso de escritura.");
    } catch (error) {
      setMessage(error instanceof Error ? (error instanceof Error ? error.message : String(error)) : "No se pudo habilitar el respaldo local.");
    }
  }

  async function handleFullBackup() {
    try {
      setBackupLoading(true);
      const backup = await generateFullBackup();
      await saveBackupToDisk(backup);
      setMessage("Copia de seguridad generada correctamente.");
    } catch (error: unknown) {
      setMessage("Error al generar copia de seguridad.");
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleExportCSV() {
    if (role !== "administrator") {
      setMessage("No autorizado");
      return;
    }
    try {
      setBackupLoading(true);
      const backup = await generateFullBackup();
      
      let products = backup.tables.products || [];
      // Si necesitasemos ocultar costo lo haríamos, pero hemos bloqueado todo a no-admin para mayor seguridad.
      const productsCSV = jsonToCSV(products);
      downloadFile(productsCSV, "alverde-productos.csv", "text/csv");

      const stockCSV = jsonToCSV(backup.tables.stock_lots || []);
      downloadFile(stockCSV, "alverde-lotes.csv", "text/csv");
      
      const customersCSV = jsonToCSV(backup.tables.customers || []);
      downloadFile(customersCSV, "alverde-clientes.csv", "text/csv");
      
      const salesCSV = jsonToCSV(backup.tables.sales || []);
      downloadFile(salesCSV, "alverde-ventas.csv", "text/csv");
      
    } catch (error: unknown) {
      setMessage("Error al exportar a Excel (CSV).");
    } finally {
      setBackupLoading(false);
    }
  }

  return (
    <section className="glass feature-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--esp-s)' }}>
      <h2>Segunda copia local y Backups (RF-41 a RF-44)</h2>
      <p style={{ fontSize: "var(--texto-s)", color: "var(--color-tinta-suave)", margin: 0 }}>
        {message}
      </p>
      
      <div style={{ display: 'flex', gap: 'var(--esp-xs)', flexWrap: 'wrap', marginTop: 'var(--esp-xs)' }}>
        <Button variant="secundario" onClick={() => void enableBackup()}>
          Elegir carpeta (Cola Offline)
        </Button>
        {role === "administrator" && (<Button variant="primario" onClick={handleFullBackup} disabled={backupLoading}>
          {backupLoading ? "Generando..." : "Descargar DB Completa"}
        </Button>)}
        <Button variant="fantasma" onClick={handleExportCSV} disabled={backupLoading}>
          Exportar a Excel (CSV)
        </Button>
      </div>
    </section>
  );
}
