begin;
select plan(6);

insert into public.branches (id, name) values
  ('00000000-0000-0000-0000-000000009001', 'Stock límite'),
  ('00000000-0000-0000-0000-000000009002', 'Otra sucursal');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000009003', 'stock-floor@test');
update public.profiles set branch_id = '00000000-0000-0000-0000-000000009001'
where id = '00000000-0000-0000-0000-000000009003';

insert into public.products (id, name, base_unit) values
  ('00000000-0000-0000-0000-000000009004', 'Producto stock límite', 'unit');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price, sold_by_weight) values
  ('00000000-0000-0000-0000-000000009005', '00000000-0000-0000-0000-000000009004', 'Unidad', 1, 100, false);
insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, branch_id) values
  ('00000000-0000-0000-0000-000000009006', '00000000-0000-0000-0000-000000009005', 1, 1, 50, 'open', '00000000-0000-0000-0000-000000009001'),
  ('00000000-0000-0000-0000-000000009007', '00000000-0000-0000-0000-000000009005', 50, 50, 50, 'open', '00000000-0000-0000-0000-000000009002');

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000009003';
set role authenticated;
select lives_ok($$select public.process_offline_sale(jsonb_build_object(
  'localId', '00000000-0000-0000-0000-000000009008',
  'deviceId', '00000000-0000-0000-0000-000000009009',
  'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'items', jsonb_build_array(
    jsonb_build_object('presentationId', '00000000-0000-0000-0000-000000009005', 'quantity', 11, 'unitPrice', 100)
  ))
))$$, 'Se acepta una venta que deja exactamente -10');
reset role;

select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-000000009006'), -10::numeric,
  'El saldo local queda en -10');
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-000000009007'), 50::numeric,
  'El stock de otra sucursal no compensa el límite');

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000009003';
set role authenticated;
select throws_ok($$select public.process_offline_sale(jsonb_build_object(
  'localId', '00000000-0000-0000-0000-000000009010',
  'deviceId', '00000000-0000-0000-0000-000000009009',
  'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'items', jsonb_build_array(
    jsonb_build_object('presentationId', '00000000-0000-0000-0000-000000009005', 'quantity', 1, 'unitPrice', 100)
  ))
))$$, '22023', null, 'Se rechaza una venta que llevaría el saldo a -11');
reset role;

select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-000000009006'), -10::numeric,
  'La operación rechazada no modifica el stock');
select is((select count(*)::int from public.sales where local_id = '00000000-0000-0000-0000-000000009010'), 0,
  'La operación rechazada no conserva una venta parcial');

select * from finish();
rollback;
