-- Tests de 20260923100000_seguridad_rls.sql. Cada bloque cita el defecto QA que cubre.
begin;
select plan(22);

-- Datos base (como postgres: dueño de las tablas, sin RLS ni guardas de API).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'emp@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.products (id, name, base_unit) values ('00000000-0000-0000-0000-0000000000f1', 'Almendras', 'gram');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', '100 g', 100, 1500);
insert into public.branches (id, name) values ('00000000-0000-0000-0000-000000000b01', 'Central');
insert into public.registers (id, branch_id, name) values ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000b01', 'Caja 1');
insert into public.registers (id, branch_id, name) values ('00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-000000000b01', 'Caja 2');
insert into public.customers (id, name) values ('00000000-0000-0000-0000-0000000000d1', 'Cliente');
insert into public.cash_shifts (id, register_id, user_id, status, closed_at, final_balance)
  values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-0000000000e1', 'closed', now(), 100);
insert into public.cash_shifts (id, register_id, user_id)
  values ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-0000000000e1');
insert into public.sales (id, local_id, user_id, payment_method, occurred_at, total_amount)
  values ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000000e1', 'cash', now(), 3000);

-- P1 · Usuario no logueado
set role anon;
select throws_ok('select * from public.employee_catalog', '42501', null, 'P1: anon NO lee employee_catalog');
select throws_ok('select * from public.employee_stock_lots', '42501', null, 'P1: anon NO lee employee_stock_lots');
select throws_ok('select public.process_offline_sale(''{}''::jsonb)', '42501', null, 'P1: anon NO ejecuta process_offline_sale');
reset role;

-- P9 · security definer sin search_path
select is(
  (select count(*)::int from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0, 'P9: ninguna función security definer sin search_path');

-- Empleado
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select lives_ok('select * from public.employee_catalog', 'Empleado lee employee_catalog');

-- P4 · Tope de fiado (RF-47)
select throws_ok($$insert into public.customers (name, credit_limit) values ('Con tope', 5000)$$, '42501', null, 'P4: empleado NO crea cliente con tope');
select lives_ok($$insert into public.customers (id, name, phone) values ('00000000-0000-0000-0000-0000000000d2', 'Nuevo', '111')$$, 'P4: empleado crea cliente sin tope');
select lives_ok($$update public.customers set phone = '222' where id = '00000000-0000-0000-0000-0000000000d2'$$, 'P4: empleado corrige el teléfono');
select throws_ok($$update public.customers set credit_limit = 1000000 where id = '00000000-0000-0000-0000-0000000000d1'$$, '42501', null, 'P4: empleado NO cambia el tope');

-- P3 · Fiado por la cola offline (RF-48)
select throws_ok($$select public.apply_offline_operation(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'credit_movement',
  'payload', jsonb_build_object('customerId', '00000000-0000-0000-0000-0000000000d1', 'movementKind', 'adjustment', 'amount', 99999)))$$,
  '42501', null, 'P3: empleado NO perdona deuda');
select ok(public.apply_offline_operation(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'credit_movement',
  'payload', jsonb_build_object('customerId', '00000000-0000-0000-0000-0000000000d1', 'movementKind', 'payment', 'amount', 500))),
  'P3: empleado registra un abono');

-- P6 · Ventas solo por RPC
select throws_ok($$insert into public.sales (local_id, user_id, payment_method, occurred_at, total_amount)
  values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', 'cash', now(), 0.01)$$, '42501', null, 'P6: empleado NO inserta ventas directo');
select throws_ok($$select public.apply_offline_operation(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale', 'payload', '{}'::jsonb))$$,
  '22023', null, 'P6: apply_offline_operation rechaza ventas');

-- P2 · Movimientos de stock
select throws_ok($$insert into public.stock_movements (local_id, kind, product_id, quantity, reason, user_id, occurred_at)
  values (gen_random_uuid(), 'adjustment', '00000000-0000-0000-0000-0000000000f1', -1, 'x', '00000000-0000-0000-0000-0000000000e1', now())$$,
  '42501', null, 'P2: empleado NO inserta movimientos de stock');

-- P7 · Turnos
update public.cash_shifts set final_balance = 999999, status = 'open' where id = '00000000-0000-0000-0000-000000000501';
select lives_ok($$update public.cash_shifts set status = 'closed', closed_at = now(), final_balance = 50 where id = '00000000-0000-0000-0000-000000000502'$$,
  'P7: cajero cierra su turno abierto');
reset role;
select is((select final_balance from public.cash_shifts where id = '00000000-0000-0000-0000-000000000501'), 100.00::numeric,
  'P7: el turno cerrado no cambió al intentar editarlo el empleado');
select is((select status from public.cash_shifts where id = '00000000-0000-0000-0000-000000000502'), 'closed',
  'P7: el cierre del propio turno quedó guardado');
select throws_ok($$insert into public.cash_shifts (register_id, user_id) values
  ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-0000000000a1')$$,
  '23505', null, 'Un solo turno abierto por caja');

-- Administradora
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select lives_ok($$update public.customers set credit_limit = 20000 where id = '00000000-0000-0000-0000-0000000000d1'$$, 'P4: administradora define el tope');
select lives_ok($$insert into public.stock_movements (local_id, kind, product_id, quantity, reason, user_id, occurred_at)
  values (gen_random_uuid(), 'adjustment', '00000000-0000-0000-0000-0000000000f1', -1, 'Rotura', '00000000-0000-0000-0000-0000000000a1', now())$$,
  'P2: administradora registra un ajuste de stock');
select throws_ok($$update public.sales set total_amount = 1 where id = '00000000-0000-0000-0000-000000000601'$$, '42501', null,
  'RF-37: ni la administradora edita el total de una venta');
select lives_ok($$update public.sales set status = 'voided' where id = '00000000-0000-0000-0000-000000000601'$$,
  'RF-37: la administradora anula una venta');
reset role;

select * from finish();
rollback;
