-- Tests de 20261009120000_anular_venta_completa.sql (T-11; defectos QA P14 y P15).
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'emp@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.branches (id, name) values ('00000000-0000-0000-0000-000000000b01', 'Central');
update public.profiles set branch_id = '00000000-0000-0000-0000-000000000b01' where id = '00000000-0000-0000-0000-0000000000e1';
insert into public.registers (id, branch_id, name) values ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000b01', 'Caja 1');
insert into public.cash_shifts (id, register_id, user_id) values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-0000000000e1');
insert into public.customers (id, name) values ('00000000-0000-0000-0000-0000000000d1', 'Marta');
insert into public.products (id, name, base_unit) values ('00000000-0000-0000-0000-0000000000f1', 'Nueces', 'unit');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'Bolsa', 1, 1500);
insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, branch_id)
  values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000c1', 10, 2, 100, 'open', '00000000-0000-0000-0000-000000000b01');

create function pg_temp.vender(p_local uuid, p_metodo text, p_cantidad int) returns boolean language sql as $$
  select public.process_offline_sale(jsonb_build_object('localId', p_local, 'deviceId', gen_random_uuid(), 'kind', 'sale',
    'payload', jsonb_build_object('paymentMethod', p_metodo, 'shiftId', '00000000-0000-0000-0000-000000000501',
      'customerId', case when p_metodo = 'credit' then '00000000-0000-0000-0000-0000000000d1' end,
      'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', p_cantidad, 'unitPrice', 1500)))))
$$;
grant execute on function pg_temp.vender(uuid, text, int) to authenticated;

-- Venta fiada de 5 con 2 en stock: 3 quedan en negativo. Después, una venta en efectivo de 1.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select pg_temp.vender('00000000-0000-0000-0000-000000007001', 'credit', 5);
select pg_temp.vender('00000000-0000-0000-0000-000000007002', 'cash', 1);
-- El empleado intenta anular: RLS no le deja tocar la fila.
update public.sales set status = 'voided' where local_id = '00000000-0000-0000-0000-000000007002';
reset role;
select is((select status::text from public.sales where local_id = '00000000-0000-0000-0000-000000007002'), 'closed', 'Un empleado no anula ventas');
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-00000000a001'), -4.000::numeric, 'Antes de anular: 2 − 5 − 1 = −4');
select is((select balance from public.customer_accounts where id = '00000000-0000-0000-0000-0000000000d1'), 7500.00::numeric, 'Antes de anular: la clienta debe 7500');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select lives_ok($$update public.sales set status = 'voided' where local_id = '00000000-0000-0000-0000-000000007001'$$, 'La administradora anula la venta fiada');
reset role;

select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-00000000a001'), 1.000::numeric,
  'P15: vuelven las 5 unidades, incluido el tramo en negativo (−4 + 5 = 1)');
select is((select balance from public.customer_accounts where id = '00000000-0000-0000-0000-0000000000d1'), 0.00::numeric,
  'P14: la clienta ya no debe la venta anulada');
select is((select count(*)::int from public.stock_movements where reason like 'Anulación de venta %' and kind = 'adjustment'), 2,
  'La devolución queda como ajuste (no como ingreso de mercadería), un movimiento por tramo');
select is((select sum(quantity) from public.stock_movements where reason like '%00000000-0000-0000-0000-000000007001%'), 0.000::numeric,
  'Movimientos de venta y de anulación suman cero');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select throws_ok($$update public.sales set status = 'closed' where local_id = '00000000-0000-0000-0000-000000007001'$$, '42501', null,
  'Una venta anulada no se reabre (no se puede devolver dos veces)');
reset role;

select * from finish();
rollback;
