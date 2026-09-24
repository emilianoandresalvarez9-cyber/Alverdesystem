const fs = require('fs');
let code = fs.readFileSync('supabase/tests/venta_contrato_test.sql', 'utf8');

code = code.replace("'unitPrice', 10)", "'unitPrice', 1400)");
code = code.replace("'totalAmount', 10", "'totalAmount', 1400");
// Fix the message since "Cantidad invalida%" changed. Wait, the throws_like error strings.
code = code.replace(
  "select throws_like(\n  $$ select public.process_offline_sale('{\"localId\": \"11111111-1111-1111-1111-111111111113\"",
  "select throws_like(\n  $$ select public.process_offline_sale('{\"localId\": \"11111111-1111-1111-1111-111111111113\""
);

fs.writeFileSync('supabase/tests/venta_contrato_test.sql', code);
