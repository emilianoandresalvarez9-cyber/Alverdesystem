const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPage.tsx', 'utf8');

if (!code.includes('import { ScaleManager }')) {
  code = code.replace(
    'import { ScalePresentations } from "../modules/admin/ScalePresentations";',
    'import { ScalePresentations } from "../modules/admin/ScalePresentations";\nimport { ScaleManager } from "../modules/admin/ScaleManager";'
  );
}

if (!code.includes('{ id: "scale_manager"')) {
  code = code.replace(
    '          <Button variant={activeTab === "scale_pres" ? "primary" : "secondary"} onClick={() => setActiveTab("scale_pres")}>Presentaciones Granel</Button>',
    '          <Button variant={activeTab === "scale_pres" ? "primary" : "secondary"} onClick={() => setActiveTab("scale_pres")}>Presentaciones Granel</Button>\n          <Button variant={activeTab === "scale_manager" ? "primary" : "secondary"} onClick={() => setActiveTab("scale_manager")}>Configuración Balanza</Button>'
  );
}

if (!code.includes('activeTab === "scale_manager" && <ScaleManager />')) {
  code = code.replace(
    '{activeTab === "scale_pres" && <ScalePresentations />}',
    '{activeTab === "scale_pres" && <ScalePresentations />}\n        {activeTab === "scale_manager" && <ScaleManager />}'
  );
}

fs.writeFileSync('src/pages/AdminPage.tsx', code);
