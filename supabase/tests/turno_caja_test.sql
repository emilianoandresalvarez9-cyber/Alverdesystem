-- Tests de 20261010050000_turno_de_caja_protegido.sql (RF-32): desde la caja, un turno sólo se
-- abre y se cierra; el monto inicial, la caja y la apertura quedan fijos; al cerrar, la base pone
-- la hora y calcula el efectivo esperado; las correcciones quedan en el historial (RF-60).
-- Roles: cajera, otra empleada, administradora, SQL Editor (postgres) y anon.
begin;
select plan(29);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'cajera@test'),
  ('00000000-0000-0000-0000-0000000000e2', 'cajera2@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.branches (id, name) values ('00000000-0000-0000-0000-000000000b01', 'Central');
update public.profiles set branch_id = '00000000-0000-0000-0000-000000000b01';
insert into public.registers (id, branch_id, name) values
  ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000b01', 'Caja 1'),
  ('00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-000000000b01', 'Caja 2');
insert into public.products (id, name, base_unit) values ('00000000-0000-0000-0000-0000000000f1', 'Nueces', 'unit');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'Bolsa', 1, 3000),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f1', 'Bolsa chica', 1, 2000);
insert into public.stock_lots (presentation_id, initial_quantity, current_quantity, purchase_cost, status, branch_id) values
  ('00000000-0000-0000-0000-0000000000c1', 50, 50, 100, 'open', '00000000-0000-0000-0000-000000000b01'),
  ('00000000-0000-0000-0000-0000000000c2', 50, 50, 100, 'open', '00000000-0000-0000-0000-000000000b01');

-- ---------- Cajera: abrir ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;

select lives_ok($$insert into public.cash_shifts (id, register_id, user_id, opened_at, initial_balance) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-0000000000e1', now(), 10000)$$,
  'Cajera: abre su turno con $10.000, como la app');
select lives_ok($$insert into public.cash_shifts (id, register_id, user_id, opened_at, initial_balance) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-0000000000e1', now(), 10000)
  on conflict (id) do nothing$$,
  'Cajera: el reintento de apertura sin conexión sigue siendo idempotente');
select throws_ok($$insert into public.cash_shifts (register_id, user_id, initial_balance, final_balance, status, closed_at) values
  ('00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-0000000000e1', 0, 999999, 'closed', now())$$,
  '42501', null, 'Cajera: no crea un turno ya cerrado con montos inventados');
select throws_ok($$insert into public.cash_shifts (register_id, user_id, initial_balance, final_balance) values
  ('00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-0000000000e1', 0, 500)$$,
  '42501', null, 'Cajera: no abre un turno con efectivo esperado ya puesto');
select throws_ok($$insert into public.cash_shifts (register_id, user_id, initial_balance) values
  ('00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-0000000000e1', -5000)$$,
  '22023', null, 'Cajera: no abre con monto inicial negativo');

-- Ventas del turno: $3.000 en efectivo y $2.000 por transferencia.
select ok(public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000501',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 1, 'unitPrice', 3000))))),
  'Cajera: vende $3.000 en efectivo');
select ok(public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'transfer', 'shiftId', '00000000-0000-0000-0000-000000000501',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c2', 'quantity', 1, 'unitPrice', 2000))))),
  'Cajera: vende $2.000 por transferencia');

-- ---------- Cajera: retocar el turno abierto ----------
select throws_ok($$update public.cash_shifts set initial_balance = 5000 where id = '00000000-0000-0000-0000-000000000501'$$,
  '42501', null, 'Cajera: no baja el monto inicial con la caja abierta');
select throws_ok($$update public.cash_shifts set register_id = '00000000-0000-0000-0000-000000000b03' where id = '00000000-0000-0000-0000-000000000501'$$,
  '42501', null, 'Cajera: no cambia la caja del turno');
select throws_ok($$update public.cash_shifts set opened_at = now() - interval '5 hours' where id = '00000000-0000-0000-0000-000000000501'$$,
  '42501', null, 'Cajera: no corre la hora de apertura');
select throws_ok($$update public.cash_shifts set final_balance = 1 where id = '00000000-0000-0000-0000-000000000501'$$,
  '42501', null, 'Cajera: no pone un efectivo esperado con la caja abierta');
select throws_ok($$update public.cash_shifts set closed_at = now() where id = '00000000-0000-0000-0000-000000000501'$$,
  '42501', null, 'Cajera: no pone hora de cierre sin cerrar');
reset role;

-- Una venta en efectivo anulada no cuenta para el efectivo esperado.
insert into public.sales (local_id, shift_id, register_id, branch_id, user_id, payment_method, occurred_at, total_amount, status)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000b01',
        '00000000-0000-0000-0000-0000000000e1', 'cash', now(), 4000, 'voided');

select is((select initial_balance from public.cash_shifts where id = '00000000-0000-0000-0000-000000000501'), 10000.00::numeric,
  'El monto inicial sigue en $10.000');

-- ---------- Cajera: cerrar, aunque mande números inventados ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select lives_ok($$update public.cash_shifts set status = 'closed', closed_at = now() - interval '3 hours', final_balance = 1
  where id = '00000000-0000-0000-0000-000000000501'$$,
  'Cajera: cierra su turno (la app manda su cálculo, acá uno inventado)');
reset role;

select is((select final_balance from public.cash_shifts where id = '00000000-0000-0000-0000-000000000501'), 13000.00::numeric,
  'Al cerrar, la base calcula el efectivo esperado: $10.000 + $3.000 (sin transferencia ni anulada)');
select is((select closed_at from public.cash_shifts where id = '00000000-0000-0000-0000-000000000501'), now(),
  'Al cerrar, la hora es la de la base, no la que mandó la caja');
select is((select count(*)::int from public.audit_history where entity = 'cash_shifts'), 0,
  'El cierre normal no ensucia el historial');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
update public.cash_shifts set status = 'open' where id = '00000000-0000-0000-0000-000000000501';
reset role;
select is((select status from public.cash_shifts where id = '00000000-0000-0000-0000-000000000501'), 'closed',
  'Cajera: no reabre un turno cerrado');

-- ---------- Otra empleada ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
insert into public.cash_shifts (id, register_id, user_id, initial_balance) values
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-0000000000e1', 8000);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select lives_ok($$insert into public.cash_shifts (id, register_id, user_id, initial_balance) values
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-0000000000e2', 2000)$$,
  'Otra empleada: abre su propio turno en la Caja 2');
update public.cash_shifts set status = 'closed' where id = '00000000-0000-0000-0000-000000000503';
update public.cash_shifts set initial_balance = 1 where id = '00000000-0000-0000-0000-000000000503';
reset role;
select is((select status || ' ' || initial_balance from public.cash_shifts where id = '00000000-0000-0000-0000-000000000503'), 'open 8000.00',
  'Otra empleada: no cierra ni toca el turno de la cajera');

-- ---------- Administradora: corrige, y queda en el historial ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select lives_ok($$update public.cash_shifts set initial_balance = 9000 where id = '00000000-0000-0000-0000-000000000501'$$,
  'Administradora: corrige el monto inicial de un turno cerrado');
select is((select count(*)::int from public.audit_history
  where entity = 'cash_shifts' and entity_id = '00000000-0000-0000-0000-000000000501' and field = 'initial_balance'
    and old_value = to_jsonb('10000.00'::text) and new_value = to_jsonb('9000.00'::text)
    and user_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'La corrección queda en el historial: campo, antes, después y quién');
select matches((select entity_label from public.audit_history_search(p_entity => 'cash_shifts') limit 1), '^Turno Caja 1 · \d\d/\d\d \d\d:\d\d$',
  'Trazabilidad muestra el turno como «Turno Caja 1 · dd/mm hh:mm»');
select lives_ok($$update public.cash_shifts set status = 'closed' where id = '00000000-0000-0000-0000-000000000502'$$,
  'Administradora: cierra un turno que la otra empleada dejó abierto');
reset role;
select is((select final_balance from public.cash_shifts where id = '00000000-0000-0000-0000-000000000502'), 2000.00::numeric,
  'Ese cierre también lo calcula la base (sin ventas: el monto inicial)');
select is((select count(*)::int from public.audit_history where entity_id = '00000000-0000-0000-0000-000000000502'), 0,
  'Cerrar un turno abierto no es una corrección: no va al historial');

-- ---------- SQL Editor (dueño de la base) ----------
select lives_ok($$update public.cash_shifts set final_balance = 12500 where id = '00000000-0000-0000-0000-000000000501'$$,
  'Desde el SQL Editor se puede corregir cualquier cosa');
select is((select count(*)::int from public.audit_history
  where entity_id = '00000000-0000-0000-0000-000000000501' and field = 'final_balance'), 1,
  'Y también queda en el historial');

-- ---------- anon ----------
set role anon;
select throws_ok($$insert into public.cash_shifts (register_id, user_id) values ('00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-0000000000e2')$$,
  '42501', null, 'anon: no abre turnos');
reset role;

select * from finish();
rollback;
