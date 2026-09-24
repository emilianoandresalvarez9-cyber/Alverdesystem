import { getSupabase } from "../supabase/client";

export interface FullBackupData {
  exportedAt: string;
  version: number;
  tables: Record<string, Record<string, unknown>[]>;
}

const TABLES_RESTORE_ORDER = [
  "categories",
  "brands",
  "labels",
  "suppliers",
  "customers",
  "products",
  "product_presentations",
  "supplier_products",
  "stock_lots",
  "sales",
  "sale_items",
  "credit_movements",
  "audit_history",
  "offline_operations"
];

/**
 * Genera un objeto con toda la base de datos operativa.
 */
export async function generateFullBackup(): Promise<FullBackupData> {
  const sb = getSupabase();
  const backup: FullBackupData = {
    exportedAt: new Date().toISOString(),
    version: 1,
    tables: {}
  };

  const fetchTable = async (table: string) => {
    const { data, error } = await sb.from(table).select("*");
    if (error) throw new Error(`Error exportando ${table}: ${error.message}`);
    return data;
  };

  for (const t of TABLES_RESTORE_ORDER) {
    backup.tables[t] = await fetchTable(t);
  }

  return backup;
}

/**
 * Descarga el JSON generado.
 */
export function downloadBackupFile(data: FullBackupData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const dateStr = new Date().toISOString().split("T")[0];
  link.download = `alverde-backup-completo-${dateStr}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Convierte un array de objetos JSON a CSV y lo descarga (RF-43)
 */
export function exportToCsv(tableName: string, data: Record<string, unknown>[]) {
  if (!data || data.length === 0) {
    console.warn("No hay datos para exportar en " + tableName);
    return;
  }

  const headers = Object.keys(data[0] || {});
  const rows = data.map(obj => 
    headers.map(header => {
      const val = obj[header];
      if (val === null || val === undefined) return "";
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(",")
  );

  const csvContent = [headers.join(","), ...rows].join("\n");
  
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `alverde-export-${tableName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Restaura la base de datos desde el JSON provisto.
 */
export async function restoreFullBackup(data: FullBackupData): Promise<void> {
  const sb = getSupabase();
  const tables = data.tables;
  
  const restoreTable = async (tableName: string, rows: Record<string, unknown>[] | undefined) => {
    if (!rows || rows.length === 0) return;
    const { error } = await sb.from(tableName).upsert(rows);
    if (error) throw new Error(`Error restaurando ${tableName}: ${error.message}`);
  };

  for (const t of TABLES_RESTORE_ORDER) {
    await restoreTable(t, tables[t]);
  }
}
