const fs = require('fs');
let code = fs.readFileSync('supabase/tests/venta_contrato_test.sql', 'utf8');

code = code.replace(/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/g, '00000000-0000-0000-0000-0000000000c1');

fs.writeFileSync('supabase/tests/venta_contrato_test.sql', code);
