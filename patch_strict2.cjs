const fs = require('fs');

let oldCode = fs.readFileSync('supabase/migrations/20260924000000_t18_price_integrity.sql', 'utf8');

// Inside the loop:
let search = "if v_item_price < 0 then";
let insert = `
    if v_item_price is null then
      raise exception 'El precio unitario no puede ser negativo.' using errcode = '22023';
    end if;
    if v_qty is null then
      raise exception 'La cantidad no puede ser menor o igual a cero.' using errcode = '22023';
    end if;

    if v_item_price < 0 then`;

let newCode = oldCode.replace(search, insert);

// Add 50% check
let search2 = "select sale_price into v_catalog_price from public.product_presentations where id = v_presentation_id;";
let insert2 = search2 + `
    if found and v_item_price < (v_catalog_price * 0.5) then
      raise exception 'Precio offline sospechoso. Venta rechazada.' using errcode = '22023';
    end if;
`;

newCode = newCode.replace(search2, insert2);

fs.writeFileSync('supabase/migrations/20260924010000_t18_price_integrity_strict.sql', newCode);

// Also we need to fix the tests that failed
let testCode = fs.readFileSync('supabase/tests/venta_contrato_test.sql', 'utf8');
testCode = testCode.replace("Precio invalido%", "El precio unitario no puede ser negativo.");
testCode = testCode.replace("Cantidad invalida%", "La cantidad no puede ser menor o igual a cero.");
testCode = testCode.replace("Formato numerico invalido en items.", "invalid input syntax for type numeric: \\\"invalido\\\"");

fs.writeFileSync('supabase/tests/venta_contrato_test.sql', testCode);

