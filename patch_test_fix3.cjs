const fs = require('fs');
let code = fs.readFileSync('supabase/tests/venta_contrato_test.sql', 'utf8');

code = code.replace(/rollback-test-id/g, '99999999-9999-9999-9999-999999999999');
code = code.replace(/'Cantidad invalida%'/g, "'La cantidad no puede%'");
code = code.replace(/'Precio invalido%'/g, "'El precio unitario no puede%'");

fs.writeFileSync('supabase/tests/venta_contrato_test.sql', code);
