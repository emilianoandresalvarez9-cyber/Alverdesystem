import { getSupabase } from "../supabase/client";

export interface FullBackupData {
  exportedAt: string;
  version: number;
  tables: {
    products?: any[];
    product_presentations?: any[];
    categories?: any[];
    brands?: any[];
    labels?: any[];
    stock_lots?: any[];
    customers?: any[];
  };
}

/**
 * Genera un objeto con toda la base de datos operativa (excepto historial y ventas para que no sea inmenso, 
 * o se podrian incluir si se requiere).
 * RF-41 a RF-44 requieren respaldar datos clave.
 */
export async function generateFullBackup(): Promise<FullBackupData> {
  const sb = getSupabase();
  const backup: FullBackupData = {
    exportedAt: new Date().toISOString(),
    version: 1,
    tables: {}
  };

  // Fetch sequential
  const fetchTable = async (table: string) => {
    const { data, error } = await sb.from(table).select("*");
    if (error) throw new Error(`Error exportando ${table}: ${error.message}`);
    return data;
  };

  backup.tables.products = await fetchTable("products");
  backup.tables.product_presentations = await fetchTable("product_presentations");
  backup.tables.categories = await fetchTable("categories");
  backup.tables.brands = await fetchTable("brands");
  backup.tables.labels = await fetchTable("labels");
  backup.tables.stock_lots = await fetchTable("stock_lots");
  backup.tables.customers = await fetchTable("customers");

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
export function exportToCsv(tableName: string, data: any[]) {
  if (!data || data.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  const headers = Object.keys(data[0]);
  const rows = data.map(obj => 
    headers.map(header => {
      const val = obj[header];
      // Escapar comillas dobles y comas
      if (val === null || val === undefined) return "";
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(",")
  );

  const csvContent = [headers.join(","), ...rows].join("\n");
  
  // Agregar BOM para que Excel detecte UTF-8 correctamente
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
 * (RF-44)
 */
export async function restoreFullBackup(data: FullBackupData): Promise<void> {
  const sb = getSupabase();
  
  // Como es un restore destructivo, normalmente requeriria borrar o hacer upsert
  // Haremos upsert tabla por tabla.
  const tables = data.tables;
  
  const restoreTable = async (tableName: string, rows: any[] | undefined) => {
    if (!rows || rows.length === 0) return;
    const { error } = await sb.from(tableName).upsert(rows);
    if (error) throw new Error(`Error restaurando ${tableName}: ${error.message}`);
  };

  // Orden respetando las claves foraneas (brands, categories primero)
  await restoreTable("brands", tables.brands);
  await restoreTable("categories", tables.categories);
  await restoreTable("labels", tables.labels);
  await restoreTable("products", tables.products);
  await restoreTable("product_presentations", tables.product_presentations);
  await restoreTable("stock_lots", tables.stock_lots);
  await restoreTable("customers", tables.customers);
}
