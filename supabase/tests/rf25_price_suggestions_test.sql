begin;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f251', 'rf25-admin@test'),
  ('00000000-0000-0000-0000-00000000f252', 'rf25-employee@test'),
  ('00000000-0000-0000-0000-00000000f256', 'rf25-other-employee@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-00000000f251';
insert into public.categories (id, name) values ('00000000-0000-0000-0000-00000000f253', 'RF25 rubro');
insert into public.products (id, name, base_unit, category_id)
  values ('00000000-0000-0000-0000-00000000f254', 'RF25 lentejas', 'gram', '00000000-0000-0000-0000-00000000f253');
insert into public.suppliers (id, name) values ('00000000-0000-0000-0000-00000000f255', 'RF25 proveedor');

select is(has_table_privilege('anon', 'public.pricing_settings', 'select'), false,
  'anon no tiene privilegio de lectura de multiplicadores generales');
select is(has_table_privilege('anon', 'public.category_price_multipliers', 'select'), false,
  'anon no tiene privilegio de lectura de multiplicadores por rubro');
select is(has_table_privilege('anon', 'public.supplier_products', 'select'), false,
  'anon no tiene privilegio de lectura de costos de proveedor');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f252';
set role authenticated;
select is((select count(*)::int from public.pricing_settings), 0,
  'Empleado no puede leer el multiplicador general');
select is((select count(*)::int from public.category_price_multipliers), 0,
  'Empleado no puede leer multiplicadores por rubro');
select is((select count(*)::int from public.supplier_products), 0,
  'Empleado no puede leer costos ni cantidades de compra');
select throws_ok($$select public.save_supplier_product_cost(
  '00000000-0000-0000-0000-00000000f254', '00000000-0000-0000-0000-00000000f255', 40000, 25000, 'L-25', true)$$,
  '42501', null, 'Empleado no puede escribir costo o cantidad de compra');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f256';
set role authenticated;
select is((select count(*)::int from public.supplier_products), 0,
  'Un segundo empleado tampoco puede leer costos ni cantidades de compra');
select throws_ok($$select public.save_supplier_product_cost(
  '00000000-0000-0000-0000-00000000f254', '00000000-0000-0000-0000-00000000f255', 40000, 25000, 'L-25', true)$$,
  '42501', null, 'Un segundo empleado tampoco puede guardar costos');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f251';
set role authenticated;
select is((select default_multiplier from public.pricing_settings where id = 1), 2.000::numeric,
  'El multiplicador general empieza en ×2');
select lives_ok($$update public.pricing_settings set default_multiplier = 2.5 where id = 1$$,
  'Administradora puede actualizar el multiplicador general');
select lives_ok($$insert into public.category_price_multipliers (category_id, multiplier)
  values ('00000000-0000-0000-0000-00000000f253', 2.2)$$,
  'Administradora puede configurar un multiplicador por rubro');
select lives_ok($$update public.products set price_multiplier = 3
  where id = '00000000-0000-0000-0000-00000000f254'$$,
  'Administradora puede configurar un multiplicador por producto');
select is((select price_multiplier from public.products
  where id = '00000000-0000-0000-0000-00000000f254'), 3.000::numeric,
  'El override por producto queda persistido');
select lives_ok($$select public.save_supplier_product_cost(
  '00000000-0000-0000-0000-00000000f254', '00000000-0000-0000-0000-00000000f255', 40000, 25000, 'L-25', true)$$,
  'Administradora puede guardar costo del envase y su cantidad base');
select is((select cost / purchase_quantity from public.supplier_products
  where product_id = '00000000-0000-0000-0000-00000000f254'
    and supplier_id = '00000000-0000-0000-0000-00000000f255'), 1.600::numeric,
  'El costo por unidad base se deriva del costo del envase / su contenido');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f252';
set role authenticated;
select is((select count(*)::int from public.products where id = '00000000-0000-0000-0000-00000000f254'), 0,
  'Empleado no puede consultar el multiplicador guardado en la tabla base de productos');
reset role;

select * from finish();
rollback;
