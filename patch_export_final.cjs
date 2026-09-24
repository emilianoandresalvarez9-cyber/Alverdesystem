const fs = require('fs');
let code = fs.readFileSync('src/shared/components/BackupSettings.tsx', 'utf8');

// We will use a regex to replace handleExportCSV function entirely
code = code.replace(/async function handleExportCSV\(\) \{[\s\S]*?\} catch \(e\) \{/, 
`async function handleExportCSV() {
    if (role !== "admin") {
      alert("No autorizado");
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
      
    } catch (e) {`
);

// We should also disable "Descargar DB Completa" for non-admins
code = code.replace(
  '<Button variant="primario" onClick={handleFullBackup} disabled={backupLoading}>',
  '{role === "admin" && <Button variant="primario" onClick={handleFullBackup} disabled={backupLoading}>'
);
code = code.replace(
  '{backupLoading ? "Generando..." : "Descargar DB Completa"}\n          </Button>',
  '{backupLoading ? "Generando..." : "Descargar DB Completa"}\n          </Button>}'
);

fs.writeFileSync('src/shared/components/BackupSettings.tsx', code);
