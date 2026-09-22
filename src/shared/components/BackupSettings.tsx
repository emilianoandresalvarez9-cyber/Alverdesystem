import { useState } from "react";
import { chooseBackupDirectory } from "../offline/backup";
import { pendingOperations } from "../offline/queue";
import { tryWritePendingOperationsBackup } from "../offline/backup";

export function BackupSettings() {
  const [message, setMessage] = useState("Aún no se eligió una carpeta de respaldo.");

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

  return (
    <section className="glass feature-card">
      <h2>Segunda copia local</h2>
      <p>{message}</p>
      <button className="button" onClick={() => void enableBackup()}>Elegir carpeta de respaldo</button>
    </section>
  );
}
