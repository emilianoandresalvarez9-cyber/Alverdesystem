-- Tests de 20261127120000_cuentas_nuevas_inactivas.sql: una cuenta recién creada en Auth no tiene
-- acceso hasta que administración la activa.
-- Roles: cuenta nueva sin activar, empleado activo, administradora y anon.
begin;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'emp@test'),
  ('00000000-0000-0000-0000-0000000000ee', 'recien-registrada@test');

select is((select count(*)::int from public.profiles where active and id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000ee')), 0,
  'Toda cuenta nueva de Auth nace inactiva');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000ee'), 'employee',
  'La cuenta nueva nace con el rol de menor privilegio');

-- Alta del personal de la prueba, como lo hace el dueño desde el SQL Editor (sin historial).
alter table public.profiles disable trigger audit_profiles_access;
update public.profiles set role = 'administrator', active = true where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set active = true where id = '00000000-0000-0000-0000-0000000000e1';
alter table public.profiles enable trigger audit_profiles_access;

insert into public.branches (id, name) values ('00000000-0000-0000-0000-000000000b01', 'Central');
update public.profiles set branch_id = '00000000-0000-0000-0000-000000000b01' where id = '00000000-0000-0000-0000-0000000000ee';
insert into public.customers (id, name, phone, credit_limit) values
  ('00000000-0000-0000-0000-0000000000d1', 'Marta Rossi', '11 5555 0001', 20000);
insert into public.products (id, name, base_unit) values ('00000000-0000-0000-0000-0000000000f1', 'Nueces', 'unit');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'Bolsa 250 g', 1, 1500);
insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, branch_id)
  values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000c1', 50, 50, 100, 'open', '00000000-0000-0000-0000-000000000b01');

-- ---------- Cuenta nueva, sin que nadie la active ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ee';
set role authenticated;
select is((select count(*)::int from public.customers), 0, 'Cuenta nueva: no ve clientes');
select is((select count(*)::int from public.customer_accounts), 0, 'Cuenta nueva: no ve saldos de fiado');
select is((select count(*)::int from public.employee_catalog), 0, 'Cuenta nueva: no ve el catálogo');
select is((select count(*)::int from public.employee_stock_lots), 0, 'Cuenta nueva: no ve lotes');
select is((select active from public.profiles where id = '00000000-0000-0000-0000-0000000000ee'), false,
  'Cuenta nueva: lee su perfil, para que la app le avise que falta activarla');
select throws_ok($$insert into public.customers (name) values ('Cliente trucho')$$, '42501', null,
  'Cuenta nueva: no crea clientes');
select throws_ok($$select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'credit', 'customerId', '00000000-0000-0000-0000-0000000000d1',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 10, 'unitPrice', 1500)))))$$,
  '42501', null, 'Cuenta nueva: no registra ventas ni le carga fiado a un cliente');
-- No hay política de UPDATE para quien no es administración: no falla, pero no cambia ninguna fila.
update public.profiles set active = true, role = 'administrator' where id = '00000000-0000-0000-0000-0000000000ee';
reset role;
select is((select active from public.profiles where id = '00000000-0000-0000-0000-0000000000ee'), false,
  'Cuenta nueva: no se activa a sí misma');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000ee'), 'employee',
  'Cuenta nueva: no se da el rol de administración');
select is((select count(*)::int from public.credit_movements), 0, 'Cuenta nueva: no quedó ningún fiado cargado');
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-00000000a001'), 50::numeric,
  'Cuenta nueva: no descontó stock');

-- ---------- Empleado activo: no activa cuentas ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
update public.profiles set active = true where id = '00000000-0000-0000-0000-0000000000ee';
reset role;
select is((select active from public.profiles where id = '00000000-0000-0000-0000-0000000000ee'), false,
  'Empleado activo: no activa la cuenta de otra persona');

-- ---------- anon ----------
set role anon;
select throws_ok($$update public.profiles set active = true$$, '42501', null, 'anon: no activa cuentas');
reset role;

-- ---------- Administradora: activa, y recién ahí la cuenta opera ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select lives_ok($$update public.profiles set active = true where id = '00000000-0000-0000-0000-0000000000ee'$$,
  'Administradora: activa la cuenta nueva');
reset role;
select is((select count(*)::int from public.audit_history
  where entity = 'profiles' and entity_id = '00000000-0000-0000-0000-0000000000ee' and field = 'active'
    and user_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'La activación queda en el historial con quién la hizo');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ee';
set role authenticated;
select is((select count(*)::int from public.customers), 1, 'Cuenta activada: ve clientes');
select is((select count(*)::int from public.employee_catalog), 1, 'Cuenta activada: ve el catálogo');
select ok(public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 1, 'unitPrice', 1500))))),
  'Cuenta activada: registra una venta');
reset role;

select * from finish();
rollback;
