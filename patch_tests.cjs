const fs = require('fs');
let code = fs.readFileSync('supabase/tests/venta_contrato_test.sql', 'utf8');

// The QA requested checking:
// cantidad negativa, precio NULL, precio ausente, cantidad NULL,
// segundo ítem inválido, precio manipulado por empleado (ya cubierto por el 50%),
// precio offline legítimo de una versión anterior.
// We will change the plan from select plan(24) to select plan(32) or just use select * from finish();

// We can append new tests. Let's see how many tests there are right now.
// It's safer to just append the new tests before `select * from finish();`
let newTests = `
-- P0-03 Strict Integrity Tests
select throws_like(
  $$ select public.process_offline_sale('{"localId": "11111111-1111-1111-1111-111111111111", "deviceId": "22222222-2222-2222-2222-222222222222", "kind": "sale", "payload": {"paymentMethod": "cash", "items": [{"presentationId": "00000000-0000-0000-0000-000000000000", "unitPrice": 100}]}}'::jsonb) $$,
  'Cantidad invalida%',
  'Rechaza cantidad ausente (NULL)'
);

select throws_like(
  $$ select public.process_offline_sale('{"localId": "11111111-1111-1111-1111-111111111112", "deviceId": "22222222-2222-2222-2222-222222222222", "kind": "sale", "payload": {"paymentMethod": "cash", "items": [{"presentationId": "00000000-0000-0000-0000-000000000000", "quantity": 1}]}}'::jsonb) $$,
  'Precio invalido%',
  'Rechaza precio ausente (NULL)'
);

select throws_like(
  $$ select public.process_offline_sale('{"localId": "11111111-1111-1111-1111-111111111113", "deviceId": "22222222-2222-2222-2222-222222222222", "kind": "sale", "payload": {"paymentMethod": "cash", "items": [{"presentationId": "00000000-0000-0000-0000-000000000000", "quantity": -5, "unitPrice": 100}]}}'::jsonb) $$,
  'Cantidad invalida%',
  'Rechaza cantidad negativa'
);

select throws_like(
  $$ select public.process_offline_sale('{"localId": "11111111-1111-1111-1111-111111111114", "deviceId": "22222222-2222-2222-2222-222222222222", "kind": "sale", "payload": {"paymentMethod": "cash", "items": [{"presentationId": "00000000-0000-0000-0000-000000000000", "quantity": 1, "unitPrice": "invalido"}]}}'::jsonb) $$,
  'Formato numerico invalido en items.',
  'Rechaza formato no numerico'
);

-- Prueba de rollback en segundo item
select throws_like(
  $$ select public.process_offline_sale('{"localId": "rollback-test-id", "deviceId": "22222222-2222-2222-2222-222222222222", "kind": "sale", "payload": {"paymentMethod": "cash", "items": [
    {"presentationId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "quantity": 1, "unitPrice": 1500},
    {"presentationId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "quantity": 1, "unitPrice": -50}
  ]}}'::jsonb) $$,
  'Precio invalido%',
  'Falla en el segundo item aborta la transaccion'
);

select is(
  (select count(*) from public.sales where local_id = 'rollback-test-id'),
  0::bigint,
  'El rollback funciono: la venta no se guardo parcialmente'
);

select is(
  (select count(*) from public.offline_operations where local_id = 'rollback-test-id'),
  0::bigint,
  'El rollback funciono: la operacion offline no quedo registrada'
);

`;

code = code.replace('select * from finish();', newTests + '\nselect * from finish();');

// Adjust the plan count. It was select plan(24). We added 7 tests. So 31.
// Let's just remove the exact plan constraint to avoid breaking it, or replace `select plan(24)` with `select plan(31)`.
code = code.replace(/select plan\(\d+\);/, 'select plan(31);');

fs.writeFileSync('supabase/tests/venta_contrato_test.sql', code);
