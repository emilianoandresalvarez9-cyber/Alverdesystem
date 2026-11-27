-- Tests de 20261127130000_lista_de_precios_publica.sql: el sitio público lee precio y disponibilidad
-- sin sesión, y nada más. Roles: anon (visitante), empleado activo y administradora (dueña de los datos).
begin;
select plan(23);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aba1', 'admin-sitio@test'),
  ('00000000-0000-0000-0000-00000000abe1', 'emp-sitio@test');
-- Vale con cuentas que nacen activas o inactivas: el personal de la prueba queda activo, sin historial.
alter table public.profiles disable trigger audit_profiles_access;
update public.profiles set active = true
  where id in ('00000000-0000-0000-0000-00000000aba1', '00000000-0000-0000-0000-00000000abe1');
alter table public.profiles enable trigger audit_profiles_access;
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-00000000aba1';

-- Centro es la sucursal más antigua: la que se muestra cuando el sitio no elige ninguna.
insert into public.branches (id, name, address, created_at, archived_at) values
  ('00000000-0000-0000-0000-00000000ab01', 'Centro', 'San Martín 100', '1999-01-01T00:00:00Z', null),
  ('00000000-0000-0000-0000-00000000ab02', 'Norte', null, now(), null),
  ('00000000-0000-0000-0000-00000000ab03', 'Cerrada', 'Belgrano 5', now(), now());
insert into public.brands (id, name) values ('00000000-0000-0000-0000-00000000ab10', 'Marca Sitio');
insert into public.categories (id, name) values ('00000000-0000-0000-0000-00000000ab11', 'Frutos secos sitio');

insert into public.products (id, name, base_unit, brand_id, category_id, active) values
  ('00000000-0000-0000-0000-00000000abf1', 'Almendras sitio', 'gram', '00000000-0000-0000-0000-00000000ab10', '00000000-0000-0000-0000-00000000ab11', true),
  ('00000000-0000-0000-0000-00000000abf2', 'Archivado sitio', 'gram', null, null, false),
  ('00000000-0000-0000-0000-00000000abf3', 'Lentejas sitio', 'gram', null, null, true);
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price, active, sold_by_weight) values
  ('00000000-0000-0000-0000-00000000abc1', '00000000-0000-0000-0000-00000000abf1', 'Bolsa 250 g', 250, 4000, true, false),
  ('00000000-0000-0000-0000-00000000abc2', '00000000-0000-0000-0000-00000000abf1', 'Bolsa 500 g', 500, 7500, true, false),
  ('00000000-0000-0000-0000-00000000abc3', '00000000-0000-0000-0000-00000000abf1', 'Presentación inactiva', 100, 2000, false, false),
  ('00000000-0000-0000-0000-00000000abc4', '00000000-0000-0000-0000-00000000abf1', 'Sin precio', 50, 0, true, false),
  ('00000000-0000-0000-0000-00000000abc5', '00000000-0000-0000-0000-00000000abf2', 'Bolsa archivada', 250, 3000, true, false),
  ('00000000-0000-0000-0000-00000000abc6', '00000000-0000-0000-0000-00000000abf3', 'Granel', 1, 3.50, true, true);
insert into public.branch_prices (branch_id, presentation_id, sale_price)
  values ('00000000-0000-0000-0000-00000000ab02', '00000000-0000-0000-0000-00000000abc1', 4500);

insert into public.stock_lots (presentation_id, initial_quantity, current_quantity, purchase_cost, branch_id, manufacturer_expiry_date) values
  -- Centro
  ('00000000-0000-0000-0000-00000000abc1', 10, 10, 1900, '00000000-0000-0000-0000-00000000ab01', current_date + 200),
  ('00000000-0000-0000-0000-00000000abc2', 2, 2, 3600, '00000000-0000-0000-0000-00000000ab01', current_date + 200),
  ('00000000-0000-0000-0000-00000000abc2', 50, 50, 3600, '00000000-0000-0000-0000-00000000ab01', current_date - 10), -- vencido: no cuenta
  ('00000000-0000-0000-0000-00000000abc6', 25000, 400, 2, '00000000-0000-0000-0000-00000000ab01', null),
  -- Norte
  ('00000000-0000-0000-0000-00000000abc6', 25000, 5000, 2, '00000000-0000-0000-0000-00000000ab02', null);

-- ---------- Permisos: se abren dos funciones y ninguna tabla ----------
select is(has_function_privilege('anon', 'public.public_price_list(uuid)', 'execute'), true, 'anon ejecuta la lista de precios pública');
select is(has_function_privilege('anon', 'public.public_branches()', 'execute'), true, 'anon ejecuta la lista de sucursales pública');
select is(has_table_privilege('anon', 'public.products', 'select'), false, 'anon sigue sin leer la tabla de productos');
select is(has_table_privilege('anon', 'public.stock_lots', 'select'), false, 'anon sigue sin leer lotes (costos, cantidades)');
select is(has_table_privilege('anon', 'public.branch_prices', 'select'), false, 'anon sigue sin leer la tabla de precios por sucursal');
select ok(pg_get_function_result('public.public_price_list(uuid)'::regprocedure) !~* 'cost|margin|multiplier|quantity|supplier|barcode|expir',
  'RNF-04: la lista pública no tiene columnas de costo, margen, cantidad, proveedor, código ni vencimiento');

-- ---------- Visitante sin sesión ----------
set role anon;
select is((select count(*)::int from public.public_price_list('00000000-0000-0000-0000-00000000ab01')
  where product_id in ('00000000-0000-0000-0000-00000000abf1', '00000000-0000-0000-0000-00000000abf2', '00000000-0000-0000-0000-00000000abf3')), 3,
  'Centro: lista las tres presentaciones vendibles');
select is((select price from public.public_price_list('00000000-0000-0000-0000-00000000ab01') where presentation_id = '00000000-0000-0000-0000-00000000abc1'),
  4000::numeric, 'Centro: sin precio propio rige el precio base');
select is((select availability from public.public_price_list('00000000-0000-0000-0000-00000000ab01') where presentation_id = '00000000-0000-0000-0000-00000000abc1'),
  'disponible', 'Centro: 10 bolsas es «disponible»');
select is((select availability from public.public_price_list('00000000-0000-0000-0000-00000000ab01') where presentation_id = '00000000-0000-0000-0000-00000000abc2'),
  'ultimas', 'Centro: 2 bolsas vigentes es «últimas»; el lote vencido de 50 no cuenta (RF-08)');
select is((select availability from public.public_price_list('00000000-0000-0000-0000-00000000ab01') where presentation_id = '00000000-0000-0000-0000-00000000abc6'),
  'ultimas', 'Centro: 400 g a granel es «últimas»');
select is((select sold_by_weight::text || ' ' || price::text from public.public_price_list('00000000-0000-0000-0000-00000000ab01') where presentation_id = '00000000-0000-0000-0000-00000000abc6'),
  'true 3.50', 'Balanza: se marca como venta por peso, con el precio por gramo (ADR-001)');
select is((select brand_name || ' / ' || category_name from public.public_price_list('00000000-0000-0000-0000-00000000ab01') where presentation_id = '00000000-0000-0000-0000-00000000abc1'),
  'Marca Sitio / Frutos secos sitio', 'Muestra marca y rubro');
select is((select price from public.public_price_list('00000000-0000-0000-0000-00000000ab02') where presentation_id = '00000000-0000-0000-0000-00000000abc1'),
  4500::numeric, 'Norte: rige su precio propio (RF-69)');
select is((select availability from public.public_price_list('00000000-0000-0000-0000-00000000ab02') where presentation_id = '00000000-0000-0000-0000-00000000abc1'),
  'sin_stock', 'Norte: el stock de Centro no cuenta (RF-65)');
select is((select availability from public.public_price_list('00000000-0000-0000-0000-00000000ab02') where presentation_id = '00000000-0000-0000-0000-00000000abc6'),
  'disponible', 'Norte: 5 kg a granel es «disponible»');
select is((select count(*)::int from public.public_price_list('00000000-0000-0000-0000-00000000ab01')
  where presentation_id in ('00000000-0000-0000-0000-00000000abc3', '00000000-0000-0000-0000-00000000abc4', '00000000-0000-0000-0000-00000000abc5')), 0,
  'No lista presentaciones inactivas, precios en $0 ni productos archivados (RF-56)');
select is((select count(*)::int from public.public_price_list('00000000-0000-0000-0000-00000000ab03')), 0,
  'Una sucursal archivada no muestra nada');
select is((select price::text || ' ' || availability from public.public_price_list() where presentation_id = '00000000-0000-0000-0000-00000000abc1'),
  '4000.00 disponible', 'Sin elegir sucursal muestra la principal (la más antigua)');
select is((select address from public.public_branches() where id = '00000000-0000-0000-0000-00000000ab01'), 'San Martín 100',
  'Sucursales: nombre y dirección de las abiertas');
select is((select count(*)::int from public.public_branches() where id = '00000000-0000-0000-0000-00000000ab03'), 0,
  'Sucursales: no lista las archivadas');
select throws_ok($$select count(*) from public.stock_lots$$, '42501', null, 'anon: leer la tabla de lotes sigue prohibido');
reset role;

-- ---------- Empleado activo: ve lo mismo que el público ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000abe1';
set role authenticated;
select is((select count(*)::int from public.public_price_list('00000000-0000-0000-0000-00000000ab01')
  where product_id in ('00000000-0000-0000-0000-00000000abf1', '00000000-0000-0000-0000-00000000abf3')), 3,
  'Con sesión de empleado la lista pública también responde');
reset role;

select * from finish();
rollback;
