const fs = require('fs');

let sm = fs.readFileSync('src/modules/admin/SuppliersManager.tsx', 'utf8');
sm = sm.replace(
  '<EmptyState title="No hay proveedores" description="Crea el primer proveedor." />',
  '<EmptyState title="No hay proveedores">Crea el primer proveedor.</EmptyState>'
);
fs.writeFileSync('src/modules/admin/SuppliersManager.tsx', sm);

let md = fs.readFileSync('src/modules/reports/MarginDashboard.tsx', 'utf8');
md = md.replace(
  '<EmptyState title="Sin datos" description="No hay lotes con costo de compra registrado." />',
  '<EmptyState title="Sin datos">No hay lotes con costo de compra registrado.</EmptyState>'
);
md = md.replace(
  'productName: pres.products?.name,',
  'productName: Array.isArray(pres.products) ? pres.products[0]?.name : pres.products?.name,'
);
fs.writeFileSync('src/modules/reports/MarginDashboard.tsx', md);
