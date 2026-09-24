const fs = require('fs');

let orig = fs.readFileSync('supabase/migrations/20260923110000_contrato_venta.sql', 'utf8');

// Extraer el body de process_offline_sale
let startIdx = orig.indexOf('create or replace function public.process_offline_sale');
let endIdx = orig.indexOf('$$;', startIdx);
if (startIdx === -1 || endIdx === -1) {
  throw new Error('No pude encontrar process_offline_sale');
}

let fnBody = orig.substring(startIdx, endIdx + 3);

// Agregar variables: v_item_price y v_catalog_price
fnBody = fnBody.replace('v_presentation_id uuid;', 'v_presentation_id uuid;\n    v_item_price numeric;\n    v_catalog_price numeric;');

// Insertar la validacion de precio justo despues de v_qty := ...
const insert = `v_qty := (v_item ->> 'quantity')::numeric;
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
fnBody = fnBody.replace("v_qty := (v_item ->> 'quantity')::numeric;", insert);

fs.writeFileSync('supabase/migrations/20260924000000_t18_price_integrity.sql', fnBody);
console.log("t18 patched!");
