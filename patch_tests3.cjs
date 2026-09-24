const fs = require('fs');
let code = fs.readFileSync('supabase/tests/venta_contrato_test.sql', 'utf8');

const tests = `
-- P0-03 Precios anómalos o negativos fallan
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;

select throws_ok(
  $$
    select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
      'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000501',
        'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 1, 'unitPrice', -50)))
    ))
  $$,
  '22023',
  'El precio unitario no puede ser negativo.',
  'No permite precios unitarios negativos (QA P0-03)'
);

select throws_ok(
  $$
    select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
      'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000501',
        'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 0, 'unitPrice', 100)))
    ))
  $$,
  '22023',
  'La cantidad no puede ser menor o igual a cero.',
  'No permite cantidad menor o igual a cero'
);

-- Venta con precio legítimo modificado genera alerta pero pasa
select ok(
  public.process_offline_sale(jsonb_build_object('localId', '80a92d8f-7f55-430c-9f6b-80a22a362fcc', 'deviceId', gen_random_uuid(), 'kind', 'sale',
    'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000501', 'totalAmount', 10,
      'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 1, 'unitPrice', 10)))
  )),
  'Acepta venta con precio diferente al catálogo (escenario offline válido)'
);

reset role;
select is(
  (select count(*) from public.stock_warnings where message like 'Diferencia de precio en presentación%' and sale_id = (select id from public.sales where local_id = '80a92d8f-7f55-430c-9f6b-80a22a362fcc'))::integer,
  1,
  'Generó alerta de stock_warnings por diferencia de precio (QA P0-03)'
);

`;

code = code.split('select * from finish();')[0] + tests + '\nselect * from finish();\nrollback;\n';

code = code.replace(/select plan\(\d+\);/, 'select plan(24);');

fs.writeFileSync('supabase/tests/venta_contrato_test.sql', code);
