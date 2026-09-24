const fs = require('fs');
let code = fs.readFileSync('src/modules/reports/ReportsDashboard.tsx', 'utf8');

code = code.replace(
  'import { exportToExcel } from "../../shared/export/excel";',
  'import { exportToExcel } from "../../shared/export/excel";\nimport { SalesHistory } from "./SalesHistory";'
);

const addIndex = code.indexOf('<GlassCard style={{ gridColumn: "1 / -1" }}>');
if (addIndex !== -1) {
  code = code.substring(0, addIndex) + '<div style={{ gridColumn: "1 / -1", marginBottom: "1rem" }}><SalesHistory /></div>\n          ' + code.substring(addIndex);
  fs.writeFileSync('src/modules/reports/ReportsDashboard.tsx', code);
}
