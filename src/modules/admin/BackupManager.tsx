import type { SupabaseAny } from "../../shared/types";
import { useState, useRef } from "react";
import { GlassCard, Button, Badge } from "../../shared/ui";
import { generateFullBackup, downloadBackupFile, exportToCsv, restoreFullBackup, type FullBackupData } from "../../shared/offline/fullBackup";

export function BackupManager() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateBackup = async () => {
    setLoading(true);
    setMessage("Generando copia de seguridad...");
    try {
      const data = await generateFullBackup();
      downloadBackupFile(data);
      setMessage("Copia generada exitosamente.");
    } catch (error: SupabaseAny) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage("Leyendo archivo...");
    try {
      const text = await file.text();
      const data = JSON.parse(text) as FullBackupData;
      
      if (!data.version || !data.tables) {
        throw new Error("Archivo de backup invalido o corrupto.");
      }

      setMessage("Restaurando datos...");
      await restoreFullBackup(data);
      setMessage("Copia de seguridad restaurada correctamente.");
    } catch (error: SupabaseAny) {
      setMessage(`Error restaurando: ${error.message}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExportCsv = async (tableName: string) => {
    setLoading(true);
    setMessage(`Exportando tabla ${tableName}...`);
    try {
      const data = await generateFullBackup();
      const tableData = (data.tables as SupabaseAny)[tableName];
      exportToCsv(tableName, tableData || []);
      setMessage("Exportacion completada.");
    } catch (error: SupabaseAny) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard>
      <h2>Gestor de Copias de Seguridad</h2>
      <p>
        Crea copias de seguridad completas de toda la base de datos, restáuralas en caso de desastre, 
        o exporta tablas específicas a Excel (CSV).
      </p>

      {message && <Badge tone="aviso" style={{ marginBottom: "1rem" }}>{message}</Badge>}

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <Button variant="primario" onClick={handleCreateBackup} disabled={loading}>
          {loading ? "Generando..." : "Crear Copia Completa (JSON)"}
        </Button>

        <Button variant="fantasma" onClick={() => fileInputRef.current?.click()} disabled={loading}>
          Restaurar desde Copia
        </Button>
        <input 
          type="file" 
          accept="application/json" 
          ref={fileInputRef} 
          style={{ display: "none" }} 
          onChange={handleFileChange}
        />
      </div>

      <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1rem" }}>
        <h3>Exportar a Excel (CSV)</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <Button variant="secundario" onClick={() => handleExportCsv("products")} disabled={loading}>Catálogo</Button>
          <Button variant="secundario" onClick={() => handleExportCsv("customers")} disabled={loading}>Clientes</Button>
          <Button variant="secundario" onClick={() => handleExportCsv("stock_lots")} disabled={loading}>Stock / Lotes</Button>
        </div>
      </div>
    </GlassCard>
  );
}
