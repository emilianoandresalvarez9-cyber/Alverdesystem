const fs = require('fs');
let code = fs.readFileSync('src/modules/reports/ReportsDashboard.tsx', 'utf8');
code = code.replace('import { getSupabase } from "../../shared/supabase/client";', 'import { getSupabase } from "../../shared/supabase/client";\nimport { exportToExcel } from "../../shared/export/excel";');
code = code.replace('import { GlassCard, SelectField, EmptyState } from "../../shared/ui";', 'import { GlassCard, SelectField, EmptyState, Button } from "../../shared/ui";');
code = code.replace(/<option value="90">.*?<\/option>\n\s*<\/SelectField>\n\s*<\/div>/g, '<option value="90">Últimos 90 días</option>\n        </SelectField>\n        <Button variant="fantasma" onClick={() => exportToExcel(["Fecha", "Total"], salesByDay.map(s => [s.date, s.total.toFixed(2)]), "Ventas_Totales")}>Exportar Resumen CSV</Button>\n      </div>');
fs.writeFileSync('src/modules/reports/ReportsDashboard.tsx', code);
