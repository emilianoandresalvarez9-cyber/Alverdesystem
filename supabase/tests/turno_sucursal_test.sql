-- Tests de 20261010060000_turno_en_su_sucursal.sql (RF-66): el empleado abre turno sólo en cajas de
-- su sucursal (la asignada o, si no tiene, la principal); administración, en cualquiera.
-- Roles: empleado de Norte, empleado sin sucursal, administradora, SQL Editor (postgres) y anon.
begin;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'norte@test'),
  ('00000000-0000-0000-0000-0000000000e2', 'sinsucursal@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-0000000000a1';

-- Central es la principal (la más antigua de todas, también más que la que crea la migración).
insert into public.branches (id, name, created_at) values
  ('00000000-0000-0000-0000-000000000b01', 'Central', '1990-01-01'),
  ('00000000-0000-0000-0000-000000000b09', 'Norte', now());
update public.profiles set branch_id = '00000000-0000-0000-0000-000000000b09' where id = '00000000-0000-0000-0000-0000000000e1';
insert into public.registers (id, branch_id, name) values
  ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000b01', 'Caja Central'),
  ('00000000-0000-0000-0000-000000000c09', '00000000-0000-0000-0000-000000000b09', 'Caja Norte'),
  ('00000000-0000-0000-0000-000000000c08', '00000000-0000-0000-0000-000000000b09', 'Caja Norte 2'),
  ('00000000-0000-0000-0000-000000000c07', '00000000-0000-0000-0000-000000000b01', 'Caja Central 2');
insert into public.products (id, name, base_unit) values ('00000000-0000-0000-0000-0000000000f1', 'Nueces', 'unit');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'Bolsa', 1, 3000);
insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, branch_id) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1', 20, 20, 100, 'open', '00000000-0000-0000-0000-000000000b01'),
  ('00000000-0000-0000-0000-00000000a009', '00000000-0000-0000-0000-0000000000a1', 20, 20, 100, 'open', '00000000-0000-0000-0000-000000000b09');

-- ---------- Empleado asignado a Norte ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select lives_ok($$insert into public.cash_shifts (id, register_id, user_id, initial_balance) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000c09', '00000000-0000-0000-0000-0000000000e1', 0)$$,
  'Empleado de Norte: abre turno en una caja de Norte');
select throws_ok($$insert into public.cash_shifts (register_id, user_id, initial_balance) values
  ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-0000000000e1', 0)$$,
  '42501', null, 'Empleado de Norte: NO abre turno en una caja de Central');
select throws_like($$insert into public.cash_shifts (register_id, user_id, initial_balance) values
  ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-0000000000e1', 0)$$,
  'Caja Central es de la sucursal Central%asigne a Central.',
  'El aviso dice qué caja, de qué sucursal y qué hacer');
select ok(public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000501',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000a1', 'quantity', 3, 'unitPrice', 3000))))),
  'Empleado de Norte: vende en su turno');
reset role;
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-00000000a009'), 17::numeric,
  'La venta descontó de Norte');
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-00000000a001'), 20::numeric,
  'Y no tocó el stock de Central');

-- ---------- Empleado sin sucursal asignada: trabaja en la principal ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
set role authenticated;
select lives_ok($$insert into public.cash_shifts (register_id, user_id, initial_balance) values
  ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-0000000000e2', 0)$$,
  'Sin sucursal asignada: abre turno en la principal (Central)');
select throws_ok($$insert into public.cash_shifts (register_id, user_id, initial_balance) values
  ('00000000-0000-0000-0000-000000000c08', '00000000-0000-0000-0000-0000000000e2', 0)$$,
  '42501', null, 'Sin sucursal asignada: NO abre turno en Norte');
reset role;

-- ---------- Administradora ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select lives_ok($$insert into public.cash_shifts (register_id, user_id, initial_balance) values
  ('00000000-0000-0000-0000-000000000c08', '00000000-0000-0000-0000-0000000000a1', 0)$$,
  'Administradora: abre turno en cualquier caja (RF-66)');
-- Reasigna al empleado de Norte a Central (RF-67), como indica el aviso.
update public.profiles set branch_id = '00000000-0000-0000-0000-000000000b01' where id = '00000000-0000-0000-0000-0000000000e1';
reset role;

-- ---------- Después de la reasignación ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select lives_ok($$insert into public.cash_shifts (register_id, user_id, initial_balance) values
  ('00000000-0000-0000-0000-000000000c07', '00000000-0000-0000-0000-0000000000e1', 0)$$,
  'Reasignado a Central: ya abre turno en una caja de Central');
select lives_ok($$update public.cash_shifts set status = 'closed' where id = '00000000-0000-0000-0000-000000000501'$$,
  'Reasignado: el turno que dejó abierto en Norte se puede cerrar igual');
reset role;
select is((select status from public.cash_shifts where id = '00000000-0000-0000-0000-000000000501'), 'closed',
  'Ese turno quedó cerrado');

-- ---------- SQL Editor ----------
select lives_ok($$insert into public.cash_shifts (register_id, user_id, initial_balance) values
  ('00000000-0000-0000-0000-000000000c09', '00000000-0000-0000-0000-0000000000e2', 0)$$,
  'Desde el SQL Editor se puede abrir un turno en cualquier caja');

-- ---------- anon ----------
set role anon;
select throws_ok($$insert into public.cash_shifts (register_id, user_id) values ('00000000-0000-0000-0000-000000000c09', '00000000-0000-0000-0000-0000000000e2')$$,
  '42501', null, 'anon: no abre turnos');
reset role;

select * from finish();
rollback;
