const fs = require('fs');
let code = fs.readFileSync('src/shared/components/BackupSettings.tsx', 'utf8');

const replacement = `
      try {
        const backup = await generateFullBackup();
        
        let products = backup.tables.products || [];
        // P1-03: Respetar RNF-04 para empleados en exportación
        if (role !== 'admin') {
          products = products.map((p: any) => {
             const { purchase_price, ...rest } = p;
             return rest;
          });
        }
        
        const productsCSV = jsonToCSV(products);
        downloadFile(productsCSV, "alverde-productos.csv", "text/csv");
  
        const stockCSV = jsonToCSV(backup.tables.stock_lots || []);
        downloadFile(stockCSV, "alverde-lotes.csv", "text/csv");
        
        const customersCSV = jsonToCSV(backup.tables.customers || []);
        downloadFile(customersCSV, "alverde-clientes.csv", "text/csv");
        
        const salesCSV = jsonToCSV(backup.tables.sales || []);
        downloadFile(salesCSV, "alverde-ventas.csv", "text/csv");
        
      } catch (e) {
`;

code = code.replace(/try\s*\{\s*const backup = await generateFullBackup\(\);[\s\S]*?downloadFile\(stockCSV, "alverde-lotes\.csv", "text\/csv"\);\s*\}\s*catch\s*\(e\)\s*\{/, replacement);

fs.writeFileSync('src/shared/components/BackupSettings.tsx', code);
