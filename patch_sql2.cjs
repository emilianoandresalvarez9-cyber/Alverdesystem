const fs = require('fs');
let code = fs.readFileSync('supabase/migrations/20260924010000_t18_price_integrity_strict.sql', 'utf8');

code = code.replace(
  "raise exception 'Precio offline sospechoso. Venta rechazada.', v_item_price using errcode = '22023';",
  "raise exception 'Precio offline sospechoso. Venta rechazada.' using errcode = '22023';"
);
code = code.replace(
  "raise exception 'La operacin necesita localId y deviceId.'",
  "raise exception 'La operacion necesita localId y deviceId.'"
);

fs.writeFileSync('supabase/migrations/20260924010000_t18_price_integrity_strict.sql', code);
