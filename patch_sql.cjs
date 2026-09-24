const fs = require('fs');
let code = fs.readFileSync('supabase/migrations/20260924010000_t18_price_integrity_strict.sql', 'utf8');

code = code.replace(/Formato num.*?rico inv.*?lido en.*?tems/g, 'Formato numerico invalido en items');
code = code.replace(/El.*?tem requiere un presentationId/g, 'El item requiere un presentationId');
code = code.replace(/Cantidad inv.*?lida:/g, 'Cantidad invalida:');
code = code.replace(/Precio inv.*?lido:/g, 'Precio invalido:');
code = code.replace(/Presentacin inexistente:/g, 'Presentacion inexistente:');
code = code.replace(/Precio offline \(%%\) sospechoso \(menor al 50%% del cat.*?logo\)\. Venta rechazada\./g, 'Precio offline sospechoso. Venta rechazada.');
code = code.replace(/Total manipulado o err.*?neo/g, 'Total manipulado o erroneo');
code = code.replace(/Diferencia de precio en presentacin .*?: Cobrado \$.*?, Cat.*?logo actual \$.*?\./g, 'Diferencia de precio.');

fs.writeFileSync('supabase/migrations/20260924010000_t18_price_integrity_strict.sql', code);
