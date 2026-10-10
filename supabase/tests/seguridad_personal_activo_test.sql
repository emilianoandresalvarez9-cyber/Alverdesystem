-- Tests de 20261010040000_solo_personal_activo.sql: una cuenta dada de baja (o que nadie dio de
-- alta como personal) no lee datos del negocio ni opera. Roles: empleado activo, otro empleado,
-- empleado dado de baja, administradora activa, administradora dada de baja y anon.
begin;
select plan(44);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000a2', 'exadmin@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'emp@test'),
  ('00000000-0000-0000-0000-0000000000e2', 'emp2@test'),
  ('00000000-0000-0000-0000-0000000000e9', 'exempleado@test');
update public.profiles set role = 'administrator'
  where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
update public.profiles set active = false
  where id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e9');

insert into public.branches (id, name) values ('00000000-0000-0000-0000-000000000b01', 'Central');
insert into public.registers (id, branch_id, name) values ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000b01', 'Caja 1');
-- Todos trabajan en Central: una venta sin turno descuenta de los lotes de esta sucursal.
update public.profiles set branch_id = '00000000-0000-0000-0000-000000000b01'
  where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e1',
               '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e9');
insert into public.suppliers (id, name) values ('00000000-0000-0000-0000-000000005001', 'Frutos del Valle');
insert into public.customers (id, name, phone, credit_limit) values
  ('00000000-0000-0000-0000-0000000000d1', 'Marta Rossi', '11 5555 0001', 20000);
insert into public.credit_movements (local_id, customer_id, kind, amount, note, user_id, occurred_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000d1', 'charge', 7300, 'Compra', '00000000-0000-0000-0000-0000000000a1', now());
insert into public.products (id, name, base_unit) values ('00000000-0000-0000-0000-0000000000f1', 'Nueces', 'unit');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'Bolsa 250 g', 1, 1500);
insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, branch_id)
  values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000c1', 50, 50, 100, 'open', '00000000-0000-0000-0000-000000000b01');
-- Ventas de antes de la baja: una del empleado que después se fue y otra del segundo empleado.
insert into public.sales (id, local_id, user_id, branch_id, payment_method, occurred_at, total_amount) values
  ('00000000-0000-0000-0000-000000006009', gen_random_uuid(), '00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-000000000b01', 'cash', now(), 1500),
  ('00000000-0000-0000-0000-000000006002', gen_random_uuid(), '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000b01', 'cash', now(), 1500);
insert into public.missing_items (id, product_id, reported_by, note, branch_id)
  values ('00000000-0000-0000-0000-000000007001', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', 'Quedan 2', '00000000-0000-0000-0000-000000000b01');
insert into public.stock_warnings (lot_id, message) values ('00000000-0000-0000-0000-00000000a001', 'Stock negativo de prueba');

-- ---------- Estructura: ninguna política queda en «cualquier cuenta con sesión» ----------
select is_empty($$
  select tablename || '.' || policyname from pg_policies
  where schemaname = 'public'
    and (coalesce(qual, '') ~ '^\(auth\.uid\(\) IS NOT NULL\)$' or coalesce(with_check, '') ~ '^\(auth\.uid\(\) IS NOT NULL\)$')
$$, 'Ninguna política de public se conforma con auth.uid() IS NOT NULL');
select is_empty($$
  select tablename || '.' || policyname from pg_policies
  where schemaname = 'public' and coalesce(qual, '') ~ 'profiles\.role = ''administrator''' and coalesce(qual, '') !~ 'active'
$$, 'Ninguna política mira el rol de administración sin mirar si la cuenta está activa');

-- ---------- Empleado dado de baja ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e9';
set role authenticated;

select is((select count(*)::int from public.customers), 0, 'Baja: no ve clientes');
select is((select count(*)::int from public.customer_accounts), 0, 'Baja: no ve saldos de fiado (vista SECURITY DEFINER)');
select is((select count(*)::int from public.customer_movements('00000000-0000-0000-0000-0000000000d1')), 0, 'Baja: no ve el historial de una cuenta');
select is((select count(*)::int from public.employee_catalog), 0, 'Baja: no ve el catálogo');
select is((select count(*)::int from public.employee_stock_lots), 0, 'Baja: no ve lotes');
select is((select count(*)::int from public.suppliers), 0, 'Baja: no ve proveedores');
select is((select count(*)::int from public.branches), 0, 'Baja: no ve sucursales');
select is((select count(*)::int from public.registers), 0, 'Baja: no ve cajas');
select is((select count(*)::int from public.missing_items), 0, 'Baja: no ve faltantes');
select is((select count(*)::int from public.sales), 0, 'Baja: ya no ve ni sus propias ventas');
select is((select active from public.profiles where id = '00000000-0000-0000-0000-0000000000e9'), false,
  'Baja: sigue leyendo su perfil, para que la app sepa que está inactiva y la saque');

select throws_ok($$insert into public.customers (name) values ('Cliente trucho')$$, '42501', null,
  'Baja: no crea clientes');
update public.customers set phone = '11 9999 9999' where id = '00000000-0000-0000-0000-0000000000d1';
select throws_ok($$insert into public.cash_shifts (register_id, user_id) values ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-0000000000e9')$$,
  '42501', null, 'Baja: no abre turno');
select throws_ok($$insert into public.missing_items (product_id, reported_by) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e9')$$,
  '42501', null, 'Baja: no reporta faltantes');
select throws_ok($$select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'credit', 'customerId', '00000000-0000-0000-0000-0000000000d1',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 33, 'unitPrice', 1500)))))$$,
  '42501', null, 'Baja: no registra ventas ni le carga fiado a un cliente');
select throws_ok($$select public.apply_offline_operation(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'credit_movement',
  'payload', jsonb_build_object('customerId', '00000000-0000-0000-0000-0000000000d1', 'movementKind', 'payment', 'amount', 100)))$$,
  '42501', null, 'Baja: no registra abonos (control que ya existía, se mantiene)');
reset role;

select is((select phone from public.customers where id = '00000000-0000-0000-0000-0000000000d1'), '11 5555 0001',
  'Baja: el teléfono del cliente no cambió');
select is((select count(*)::int from public.credit_movements where customer_id = '00000000-0000-0000-0000-0000000000d1'), 1,
  'Baja: no quedó ningún fiado nuevo en la cuenta');
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-00000000a001'), 50::numeric,
  'Baja: no descontó stock');

-- ---------- Administradora dada de baja ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
set role authenticated;
select is((select count(*)::int from public.stock_warnings), 0, 'Administradora de baja: no ve avisos de stock');
select is((select count(*)::int from public.customers), 0, 'Administradora de baja: no ve clientes');
update public.missing_items set resolved = true where id = '00000000-0000-0000-0000-000000007001';
reset role;
select is((select resolved from public.missing_items where id = '00000000-0000-0000-0000-000000007001'), false,
  'Administradora de baja: no resuelve faltantes');

-- ---------- Empleado activo: todo lo de antes sigue andando ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select is((select count(*)::int from public.customers), 1, 'Empleado activo: ve clientes');
select is((select balance from public.customer_accounts where id = '00000000-0000-0000-0000-0000000000d1'), 7300.00::numeric(14, 2),
  'Empleado activo: ve el saldo del fiado');
select is((select count(*)::int from public.customer_movements('00000000-0000-0000-0000-0000000000d1')), 1,
  'Empleado activo: ve el historial de la cuenta');
select is((select count(*)::int from public.employee_catalog), 1, 'Empleado activo: ve el catálogo');
select is((select count(*)::int from public.suppliers), 1, 'Empleado activo: ve proveedores');
select is((select count(*)::int from public.registers), 1, 'Empleado activo: ve cajas');
select is((select count(*)::int from public.missing_items), 1, 'Empleado activo: ve faltantes');
select lives_ok($$insert into public.customers (name, phone) values ('Cliente nuevo', '11 4444 0000')$$,
  'Empleado activo: crea clientes');
select lives_ok($$insert into public.missing_items (product_id, reported_by) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1')$$,
  'Empleado activo: reporta faltantes');
select lives_ok($$insert into public.cash_shifts (id, register_id, user_id) values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-0000000000e1')$$,
  'Empleado activo: abre su turno');
select ok(public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'credit', 'customerId', '00000000-0000-0000-0000-0000000000d1', 'shiftId', '00000000-0000-0000-0000-000000000501',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 2, 'unitPrice', 1500))))),
  'Empleado activo: registra una venta fiada');
select is((select count(*)::int from public.sales), 1, 'Empleado activo: ve sólo su venta, no la del otro empleado');
select throws_ok($$insert into public.customers (name, credit_limit) values ('Con tope', 50000)$$, '42501', null,
  'Empleado activo: sigue sin poder poner tope de fiado (RF-47)');
reset role;

-- ---------- Administradora activa ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select is((select count(*)::int from public.stock_warnings), 1, 'Administradora activa: ve avisos de stock');
select is((select count(*)::int from public.sales), 3, 'Administradora activa: ve todas las ventas');
select is((select balance from public.customer_accounts where id = '00000000-0000-0000-0000-0000000000d1'), 10300.00::numeric(14, 2),
  'Administradora activa: el saldo suma la venta fiada del empleado');
reset role;

-- ---------- anon (sin sesión) ----------
reset request.jwt.claim.sub;
set role anon;
select throws_ok($$select count(*) from public.customers$$, '42501', null, 'anon: sin permiso sobre clientes');
select throws_ok($$select count(*) from public.customer_accounts$$, '42501', null, 'anon: sin permiso sobre saldos');
select throws_ok($$select public.process_offline_sale('{}'::jsonb)$$, '42501', null, 'anon: no ejecuta la venta');
select throws_ok($$select public.is_active_staff()$$, '42501', null, 'anon: no ejecuta is_active_staff');
reset role;

select * from finish();
rollback;
