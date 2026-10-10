begin;
select plan(7);

insert into public.branches (id, name) values
  ('00000000-0000-0000-0000-000000008001', 'Centro aislado'),
  ('00000000-0000-0000-0000-000000008002', 'Norte aislado');
insert into public.registers (id, branch_id, name) values
  ('00000000-0000-0000-0000-000000008003', '00000000-0000-0000-0000-000000008001', 'Caja Centro aislado'),
  ('00000000-0000-0000-0000-000000008004', '00000000-0000-0000-0000-000000008002', 'Caja Norte aislado');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000008005', 'branch-employee@test'),
  ('00000000-0000-0000-0000-000000008006', 'branch-admin@test');
update public.profiles set branch_id = '00000000-0000-0000-0000-000000008001'
where id = '00000000-0000-0000-0000-000000008005';
update public.profiles set role = 'administrator'
where id = '00000000-0000-0000-0000-000000008006';

insert into public.products (id, name, base_unit) values
  ('00000000-0000-0000-0000-000000008007', 'Producto caja aislada', 'unit');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price, sold_by_weight) values
  ('00000000-0000-0000-0000-000000008008', '00000000-0000-0000-0000-000000008007', 'Unidad', 1, 100, false);
insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, branch_id) values
  ('00000000-0000-0000-0000-000000008009', '00000000-0000-0000-0000-000000008008', 5, 5, 50, 'open', '00000000-0000-0000-0000-000000008002');

-- La cuenta tiene un turno abierto viejo en Norte, aunque ahora trabaja en Centro.
insert into public.cash_shifts (id, register_id, user_id) values
  ('00000000-0000-0000-0000-000000008010', '00000000-0000-0000-0000-000000008004', '00000000-0000-0000-0000-000000008005');

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000008005';
set role authenticated;
select results_eq(
  $$select name from public.registers order by name$$,
  $$values ('Caja Centro aislado'::text)$$,
  'El empleado solo puede leer las cajas de su sucursal');
select is((select count(*)::int from public.cash_shifts), 0,
  'El empleado no puede leer su turno abierto de otra sucursal');
select throws_ok($$insert into public.cash_shifts (id, register_id, user_id)
  values ('00000000-0000-0000-0000-000000008011', '00000000-0000-0000-0000-000000008004', auth.uid())$$,
  '42501', null, 'No puede abrir un turno en la caja de Norte');
select throws_ok($$select public.process_offline_sale(jsonb_build_object(
  'localId', '00000000-0000-0000-0000-000000008012',
  'deviceId', '00000000-0000-0000-0000-000000008013',
  'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000008010',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-000000008008', 'quantity', 1, 'unitPrice', 100)))
))$$, '42501', null, 'Una venta sincronizada no usa un turno de otra sucursal');
reset role;

select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-000000008009'), 5::numeric,
  'La venta rechazada no toca stock de Norte');
select is((select count(*)::int from public.sales where local_id = '00000000-0000-0000-0000-000000008012'), 0,
  'La venta rechazada no crea datos parciales');

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000008006';
set role authenticated;
select is((select count(*)::int from public.registers), 2,
  'La administración conserva acceso a las cajas de ambas sucursales');
reset role;

select * from finish();
rollback;
