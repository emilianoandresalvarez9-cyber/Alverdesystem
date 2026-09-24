const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPage.tsx', 'utf8');

code = code.replace(
  'import { ProductsManager } from "../modules/admin/ProductsManager";',
  'import { ProductsManager } from "../modules/admin/ProductsManager";\nimport { SuppliersManager } from "../modules/admin/SuppliersManager";\nimport { MarginDashboard } from "../modules/reports/MarginDashboard";'
);

code = code.replace(
  'type AdminTab = "reports" | "stock" | "fractioning" | "classifiers" | "products" | "restock" | "barcodes" | "scale" | "branches" | "audit" | "settings";',
  'type AdminTab = "reports" | "margins" | "stock" | "fractioning" | "classifiers" | "products" | "suppliers" | "restock" | "barcodes" | "scale" | "branches" | "audit" | "settings";'
);

const renderNavIndex = code.indexOf('<Button variant={activeTab === "reports"');
if (renderNavIndex !== -1) {
  const insertNav = `<Button variant={activeTab === "margins" ? "primario" : "fantasma"} onClick={() => setActiveTab("margins")}>Márgenes</Button>
            <Button variant={activeTab === "suppliers" ? "primario" : "fantasma"} onClick={() => setActiveTab("suppliers")}>Proveedores</Button>\n            `;
  code = code.substring(0, renderNavIndex) + insertNav + code.substring(renderNavIndex);
}

const renderContentIndex = code.indexOf('{activeTab === "reports" && <ReportsDashboard />}');
if (renderContentIndex !== -1) {
  const insertContent = `{activeTab === "margins" && <MarginDashboard />}
          {activeTab === "suppliers" && <SuppliersManager />}\n          `;
  code = code.substring(0, renderContentIndex) + insertContent + code.substring(renderContentIndex);
}

fs.writeFileSync('src/pages/AdminPage.tsx', code);
