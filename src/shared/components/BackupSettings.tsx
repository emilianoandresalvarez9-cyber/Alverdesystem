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
    } catch (error: any) {
      setMessage("Error al restaurar: " + error.message);
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
      setMessage(error instanceof Error ? error.message : "No se pudo habilitar el respaldo local.");
    }
  }

  async function handleFullBackup() {
    try {
      setBackupLoading(true);
      const backup = await generateFullBackup();
      await saveBackupToDisk(backup);
      alert("Copia de seguridad generada correctamente.");
    } catch (e) {
      alert("Error al generar copia de seguridad.");
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleExportCSV() {
    try {
      setBackupLoading(true);
      const backup = await generateFullBackup();
      
      // Exportar tabla de productos como ejemplo de a Excel
      const productsCSV = jsonToCSV(backup.tables.products || []);
      downloadFile(productsCSV, "alverde-productos.csv", "text/csv");

      const stockCSV = jsonToCSV(backup.tables.stock_lots || []);
      downloadFile(stockCSV, "alverde-lotes.csv", "text/csv");
      
    } catch (e) {
      alert("Error al exportar a Excel (CSV).");
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
        <Button variant="primario" onClick={handleFullBackup} disabled={backupLoading}>
          {backupLoading ? "Generando..." : "Descargar DB Completa"}
        </Button>
        <Button variant="fantasma" onClick={handleExportCSV} disabled={backupLoading}>
          Exportar a Excel (CSV)
        </Button>
      </div>
    </section>
  );
}
