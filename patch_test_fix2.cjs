const fs = require('fs');
let code = fs.readFileSync('supabase/tests/venta_contrato_test.sql', 'utf8');

code = code.replace(/\$ select/g, '$$$$ select'); // $$ becomes $ in replace, so $$$$ becomes $$
code = code.replace(/\$ \$,/g, '$$$$ $$,'); 
code = code.replace(/\) \$,/g, ') $$$$,');

fs.writeFileSync('supabase/tests/venta_contrato_test.sql', code);
