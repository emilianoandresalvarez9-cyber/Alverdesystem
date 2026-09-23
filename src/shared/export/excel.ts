/**
 * Utilidad genérica para exportar tablas a Excel (CSV con BOM UTF-8).
 * RF-05, T-14.
 */

export function exportToExcel(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  filename: string
) {
  const allRows: string[][] = [headers, ...rows.map(row => row.map(cell => String(cell ?? "")))];

  // Generar CSV con BOM UTF-8 para que Excel lo abra correctamente
  const csv = "\uFEFF" + allRows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")
  ).join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
