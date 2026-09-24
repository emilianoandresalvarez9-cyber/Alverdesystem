const fs = require('fs');
let code = fs.readFileSync('supabase/migrations/20260924000000_t18_price_integrity.sql', 'utf8');

// I want to insert price validation at the beginning of the items loop
const insertPriceValidation = `
    v_item_price := (v_item ->> 'unitPrice')::numeric;
    
    if v_item_price < 0 then
      raise exception 'El precio unitario no puede ser negativo.' using errcode = '22023';
    end if;
    if v_qty <= 0 then
      raise exception 'La cantidad no puede ser menor o igual a cero.' using errcode = '22023';
    end if;
    
    select sale_price into v_catalog_price from public.product_presentations where id = v_presentation_id;
    if found and abs(v_catalog_price - v_item_price) >= 0.01 then
      insert into public.stock_warnings (sale_id, message)
      values (v_sale_id, format('Diferencia de precio en presentación %s: Cobrado $%s, Catálogo actual $%s.', v_presentation_id, v_item_price, v_catalog_price));
    end if;
`;

code = code.replace(
  "v_qty := (v_item ->> 'quantity')::numeric;",
  "v_qty := (v_item ->> 'quantity')::numeric;" + insertPriceValidation
);

// I also need to declare v_item_price and v_catalog_price
code = code.replace(
  "v_presentation_id uuid;",
  "v_presentation_id uuid;\n  v_item_price numeric;\n  v_catalog_price numeric;"
);

// And we need to remove the first few lines of the file since it has other stuff like CREATE TABLE in `110000_contrato_venta.sql`.
// Wait! `110000_contrato_venta.sql` creates tables too. We only want the function!
// It's better to just write the function completely from scratch using the body from `110000`.
