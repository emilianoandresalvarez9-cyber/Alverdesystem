const fs = require('fs');
let code = fs.readFileSync('src/modules/stock/StockDashboard.tsx', 'utf8');
code = code.replace('import { FractioningModal } from "../fractioning/FractioningModal";', 'import { FractioningModal } from "../fractioning/FractioningModal";\nimport { exportToExcel } from "../../shared/export/excel";');
code = code.replace('<Button variant="secundario" onClick={refreshLots}>\n          Actualizar\n        </Button>', `<Button variant="fantasma" onClick={() => exportToExcel(
          ["Producto", "Proveedor", "Marca", "Nro Remito", "Ingreso", "Apertura", "Vencimiento", "Lote Prov", "Unidades Inic", "Unidades Disp", "Estado"],
          lots.map(l => [
            l.product?.name ?? "",
            l.supplier?.name ?? "",
            l.product?.brand?.name ?? "",
            l.delivery_note ?? "",
            l.created_at.split("T")[0],
            l.opened_at ? l.opened_at.split("T")[0] : "",
            l.effective_expiry_date?.split("T")[0] ?? "",
            l.supplier_lot_code ?? "",
            l.initial_quantity,
            l.available_quantity,
            l.status
          ]),
          "lotes"
        )}>
          Exportar
        </Button>
        <Button variant="secundario" onClick={refreshLots}>
          Actualizar
        </Button>`);
fs.writeFileSync('src/modules/stock/StockDashboard.tsx', code);
