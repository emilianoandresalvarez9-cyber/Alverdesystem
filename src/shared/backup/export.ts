import { getSupabase } from "../supabase/client";

export interface BackupData {
  timestamp: string;
  version: string;
  tables: Record<string, Record<string, unknown>[]>;
}

const TABLES_TO_BACKUP = [
  "products",
  "product_presentations",
  "stock_lots",
  "stock_movements",
  "customers",
  "credit_movements",
  "sales",
  "sale_items",
  "audit_history",
  "supplier_products",
  "suppliers",
  "offline_operations"
];

/**
 * Genera un objeto con todos los datos de las tablas principales (RF-41)
 */
export async function generateFullBackup(): Promise<BackupData> {
  const supabase = getSupabase();
  const backup: BackupData = {
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    tables: {}
  };

  for (const table of TABLES_TO_BACKUP) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      throw new Error(`Fallo critico exportando la tabla ${table}: ${error.message}`);
    } else {
      backup.tables[table] = data || [];
    }
  }

  return backup;
}

/**
 * Convierte datos JSON a formato CSV compatible con Excel (RF-43)
 */
export function jsonToCSV(data: Record<string, unknown>[]): string {
  if (!data || data.length === 0) return "";
  const headers = Object.keys(data[0] || {});
  const rows = data.map(row => 
    headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

/**
 * Descarga el contenido en formato archivo (CSV o JSON)
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Guarda el backup automaticamente en el disco mediante File System Access API (RF-42)
 */
export async function saveBackupToDisk(backup: BackupData, directoryHandle?: FileSystemDirectoryHandle): Promise<boolean> {
  let writable: FileSystemWritableFileStream | undefined;
  try {
    const jsonString = JSON.stringify(backup, null, 2);
    
    // Si tenemos permiso en un directorio (Drive, pendrive) guardamos ahi
    if (directoryHandle && directoryHandle.getFileHandle) {
      const filename = `alverde-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
      writable = await fileHandle.createWritable();
      await writable.write(jsonString);
      await writable.close();
      return true;
    }
    
    // Fallback: descarga manual
    downloadFile(jsonString, `alverde-backup-manual.json`, "application/json");
    return true;
  } catch (error) {
    if (writable) {
      try {
        await writable.abort();
      } catch {
        // Mantener el error original y evitar que un fallo de limpieza lo oculte.
      }
    }
    console.error("Error al guardar backup:", error);
    return false;
  }
}
