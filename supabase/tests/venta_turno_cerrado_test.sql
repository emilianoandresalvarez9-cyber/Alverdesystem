-- Tests de 20261010070000_venta_en_turno_cerrado.sql: una venta que llega para un turno ya cerrado
-- se acepta (no se pierde) y queda para revisión de administración, sin tocar el cierre.
-- Roles: cajera, otra empleada, administradora y anon.
begin;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'cajera@test'),
  ('00000000-0000-0000-0000-0000000000e2', 'cajera2@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.branches (id, name, created_at) values ('00000000-0000-0000-0000-000000000b01', 'Central', '1990-01-01');
update public.profiles set branch_id = '00000000-0000-0000-0000-000000000b01';
insert into public.registers (id, branch_id, name) values ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000b01', 'Caja 1');
insert into public.products (id, name, base_unit) values ('00000000-0000-0000-0000-0000000000f1', 'Nueces', 'unit');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'Bolsa', 1, 3000);
insert into public.stock_lots (presentation_id, initial_quantity, current_quantity, purchase_cost, status, branch_id)
  values ('00000000-0000-0000-0000-0000000000c1', 50, 50, 100, 'open', '00000000-0000-0000-0000-000000000b01');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
insert into public.cash_shifts (id, register_id, user_id, initial_balance) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-0000000000e1', 1000);
select ok(public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', '00000000-0000-0000-0000-00000000d001', 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000501',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 1, 'unitPrice', 3000))))),
  'Venta normal con el turno abierto');
select is((select count(*)::int from public.stock_warnings where message like 'La venta llegó con el turno ya cerrado%'), 0,
  'Una venta con el turno abierto no deja aviso');
update public.cash_shifts set status = 'closed' where id = '00000000-0000-0000-0000-000000000501';
reset role;
select is((select final_balance from public.cash_shifts where id = '00000000-0000-0000-0000-000000000501'), 4000.00::numeric,
  'El cierre guardó $1.000 + $3.000');

-- La venta que el equipo hizo sin conexión llega después del cierre.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select ok(public.process_offline_sale(jsonb_build_object('localId', '00000000-0000-0000-0000-000000007001', 'deviceId', '00000000-0000-0000-0000-00000000d001', 'kind', 'sale',
  'createdAt', now() - interval '10 minutes',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000501',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 2, 'unitPrice', 3000))))),
  'La venta que llega con el turno cerrado se acepta: no se pierde');
select ok(public.process_offline_sale(jsonb_build_object('localId', '00000000-0000-0000-0000-000000007001', 'deviceId', '00000000-0000-0000-0000-00000000d001', 'kind', 'sale',
  'createdAt', now() - interval '10 minutes',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000501',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 2, 'unitPrice', 3000))))),
  'El reintento de esa misma venta es idempotente');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select throws_ok($$select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000501',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 1, 'unitPrice', 3000)))))$$,
  '42501', null, 'Otra empleada no carga ventas en el turno cerrado de la cajera');
reset role;

select is((select count(*)::int from public.stock_warnings w join public.sales s on s.id = w.sale_id
  where s.local_id = '00000000-0000-0000-0000-000000007001' and w.message like 'La venta llegó con el turno ya cerrado (cerrado el __/__ __:__)%'), 1,
  'Queda un aviso para revisión, con la hora de cierre (y uno solo, aunque se reintente)');
select is((select final_balance from public.cash_shifts where id = '00000000-0000-0000-0000-000000000501'), 4000.00::numeric,
  'El efectivo esperado guardado al cerrar no cambia');
select is((select count(*)::int from public.sales where shift_id = '00000000-0000-0000-0000-000000000501'), 2,
  'La venta tardía quedó registrada en su turno');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select is((select count(*)::int from public.stock_warnings_for_review() where message like 'La venta llegó con el turno ya cerrado%'), 1,
  'Administración la ve en la revisión');
reset role;

set role anon;
select throws_ok($$select public.process_offline_sale('{}'::jsonb)$$, '42501', null, 'anon: no ejecuta la venta');
reset role;

select * from finish();
rollback;
