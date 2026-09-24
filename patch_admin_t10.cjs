const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPage.tsx', 'utf8');

code = code.replace(
  'import { ProductsManager } from "../modules/admin/ProductsManager";',
  'import { ProductsManager } from "../modules/admin/ProductsManager";\nimport { BulkPriceUpdate } from "../modules/admin/BulkPriceUpdate";'
);

code = code.replace(
  'type AdminTab = "reports" | "margins" | "stock" | "fractioning" | "classifiers" | "products" | "suppliers" | "restock" | "barcodes" | "scale" | "branches" | "audit" | "settings";',
  'type AdminTab = "reports" | "margins" | "stock" | "fractioning" | "classifiers" | "products" | "prices" | "suppliers" | "restock" | "barcodes" | "scale" | "branches" | "audit" | "settings";'
);

const renderNavIndex = code.indexOf('<Button variant={activeTab === "margins"');
if (renderNavIndex !== -1) {
  const insertNav = `<Button variant={activeTab === "prices" ? "primario" : "fantasma"} onClick={() => setActiveTab("prices")}>Actualizar Precios</Button>\n            `;
  code = code.substring(0, renderNavIndex) + insertNav + code.substring(renderNavIndex);
}

const renderContentIndex = code.indexOf('{activeTab === "products" && <ProductsManager />}');
if (renderContentIndex !== -1) {
  const insertContent = `{activeTab === "prices" && <BulkPriceUpdate />}\n          `;
  code = code.substring(0, renderContentIndex) + insertContent + code.substring(renderContentIndex);
}

fs.writeFileSync('src/pages/AdminPage.tsx', code);
