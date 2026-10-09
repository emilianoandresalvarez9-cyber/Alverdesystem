-- RF-28 / RF-30: actualización masiva con vista previa, aplicación atómica y lista de cambios.
begin;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f281', 'rf28-admin@test'),
  ('00000000-0000-0000-0000-00000000f282', 'rf28-employee@test'),
  ('00000000-0000-0000-0000-00000000f283', 'rf28-other-employee@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-00000000f281';

insert into public.brands (id, name) values ('00000000-0000-0000-0000-00000000f2b1', 'RF28 marca');
insert into public.categories (id, name) values ('00000000-0000-0000-0000-00000000f2c1', 'RF28 rubro');
insert into public.suppliers (id, name) values ('00000000-0000-0000-0000-00000000f2d1', 'RF28 proveedor');
insert into public.products (id, name, base_unit, brand_id, category_id) values
  ('00000000-0000-0000-0000-00000000f2a1', 'RF28 almendras', 'gram', '00000000-0000-0000-0000-00000000f2b1', '00000000-0000-0000-0000-00000000f2c1'),
  ('00000000-0000-0000-0000-00000000f2a2', 'RF28 aceite', 'millilitre', null, null);
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price) values
  ('00000000-0000-0000-0000-00000000f2e1', '00000000-0000-0000-0000-00000000f2a1', 'Granel', 1000, 14800),
  ('00000000-0000-0000-0000-00000000f2e2', '00000000-0000-0000-0000-00000000f2a1', 'Paquete 250 g', 250, 4100),
  ('00000000-0000-0000-0000-00000000f2e3', '00000000-0000-0000-0000-00000000f2a2', 'Frasco 500 ml', 500, 2945);
insert into public.supplier_products (product_id, supplier_id, cost, is_primary)
  values ('00000000-0000-0000-0000-00000000f2a2', '00000000-0000-0000-0000-00000000f2d1', 1500, true);

-- ---------- anon ----------
select is(has_function_privilege('anon', 'public.bulk_update_prices(numeric, text, uuid, boolean, numeric)', 'execute'), false,
  'anon no puede ejecutar la actualización masiva');
select is(has_function_privilege('anon', 'public.price_batch_changes(uuid)', 'execute'), false,
  'anon no puede leer la lista de reetiquetado');
select is(has_table_privilege('anon', 'public.price_update_batches', 'select'), false,
  'anon no lee los lotes de actualización');

-- ---------- empleado ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f282';
set role authenticated;
select throws_ok($$select * from public.bulk_update_prices(10, 'all', null, false, 100)$$,
  '42501', null, 'Empleado no puede ni previsualizar la actualización masiva');
select throws_ok($$select * from public.bulk_update_prices(10, 'all', null, true, 100)$$,
  '42501', null, 'Empleado no puede aplicar la actualización masiva');
select is((select count(*)::int from public.price_update_batches), 0,
  'Empleado no ve lotes de actualización');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f283';
set role authenticated;
select throws_ok($$select * from public.bulk_update_prices(10, 'all', null, true, 100)$$,
  '42501', null, 'Otro empleado tampoco puede aplicar la actualización masiva');
reset role;

-- ---------- administradora ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f281';
set role authenticated;

select throws_ok($$select * from public.bulk_update_prices(0, 'all', null, false, 100)$$,
  '22023', null, 'Porcentaje cero se rechaza');
select throws_ok($$select * from public.bulk_update_prices(-100, 'all', null, false, 100)$$,
  '22023', null, 'Porcentaje -100 o menor se rechaza');
select throws_ok($$select * from public.bulk_update_prices(10, 'brand', null, false, 100)$$,
  '22023', null, 'Alcance por marca sin marca se rechaza');

-- Vista previa: calcula pero no toca nada (RF-28: revisar antes de confirmar)
select results_eq(
  $$select presentation_name, old_price, new_price from public.bulk_update_prices(10, 'all', null, false, 100)
    where product_name = 'RF28 almendras' order by presentation_name$$,
  $$values ('Granel', 14800::numeric, 16300::numeric), ('Paquete 250 g', 4100::numeric, 4500::numeric)$$,
  'La vista previa muestra precio anterior y nuevo redondeado a múltiplo de 100 (RF-29)');
select is((select sale_price from public.product_presentations where id = '00000000-0000-0000-0000-00000000f2e1'),
  14800::numeric, 'La vista previa no cambia el precio');
select is((select count(*)::int from public.price_update_batches), 0,
  'La vista previa no registra un lote');
select is((select batch_id from public.bulk_update_prices(10, 'all', null, false, 100) limit 1), null,
  'La vista previa no devuelve lote');

-- Alcance por proveedor (RF-28): solo el aceite tiene proveedor
select results_eq(
  $$select product_name from public.bulk_update_prices(10, 'supplier', '00000000-0000-0000-0000-00000000f2d1', false, null)$$,
  $$values ('RF28 aceite')$$,
  'El alcance por proveedor solo toma los productos de ese proveedor');
select is((select new_price from public.bulk_update_prices(10, 'supplier', '00000000-0000-0000-0000-00000000f2d1', false, null)),
  3239.50::numeric, 'Sin redondeo a 100, el nuevo precio queda a dos decimales');

-- Aplicar: atómico, con lote e historial (RF-28 + RF-30)
select is((select count(*)::int from public.bulk_update_prices(10, 'category', '00000000-0000-0000-0000-00000000f2c1', true, 100)),
  2, 'Aplicar por rubro devuelve las dos presentaciones cambiadas');
select results_eq(
  $$select id, sale_price from public.product_presentations where product_id = '00000000-0000-0000-0000-00000000f2a1' order by name$$,
  $$values ('00000000-0000-0000-0000-00000000f2e1'::uuid, 16300::numeric), ('00000000-0000-0000-0000-00000000f2e2'::uuid, 4500::numeric)$$,
  'Los precios del rubro quedaron actualizados y redondeados');
select is((select sale_price from public.product_presentations where id = '00000000-0000-0000-0000-00000000f2e3'),
  2945::numeric, 'El producto fuera del rubro no cambió');
select is((select changed_count from public.price_update_batches order by created_at desc limit 1), 2,
  'El lote registra cuántas presentaciones cambiaron');
select results_eq(
  $$select presentation_name, old_price, new_price
    from public.price_batch_changes((select id from public.price_update_batches order by created_at desc limit 1))
    order by presentation_name$$,
  $$values ('Granel', 14800::numeric, 16300::numeric), ('Paquete 250 g', 4100::numeric, 4500::numeric)$$,
  'La lista de reetiquetado del lote muestra solo lo que cambió, con precio anterior y nuevo (RF-30)');
create temp table _rf28_batch as select id from public.price_update_batches order by created_at desc limit 1;
reset role;

-- Un empleado no puede leer la lista de reetiquetado aunque tenga el id del lote
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f282';
set role authenticated;
select is((select count(*)::int from public.price_batch_changes((select id from _rf28_batch))), 0,
  'Empleado no obtiene filas de la lista de reetiquetado');
reset role;

select * from finish();
rollback;
