const fs = require('fs');
let code = fs.readFileSync('src/modules/customers/CustomersPage.tsx', 'utf8');
code = code.replace('import { CustomerCreditModal } from "./CustomerCreditModal";', 'import { CustomerCreditModal } from "./CustomerCreditModal";\nimport { exportToExcel } from "../../shared/export/excel";');
code = code.replace('<Button onClick={() => setCreating(true)}>Nuevo cliente</Button>', '<Button onClick={() => setCreating(true)}>Nuevo cliente</Button>\n        <Button variant="fantasma" onClick={() => exportToExcel(["Nombre", "Telefono", "Saldo", "Activo"], visible.map(c => [c.name, c.phone || "", c.balance.toFixed(2), c.active ? "Si" : "No"]), "clientes")}>Exportar</Button>');
fs.writeFileSync('src/modules/customers/CustomersPage.tsx', code);
