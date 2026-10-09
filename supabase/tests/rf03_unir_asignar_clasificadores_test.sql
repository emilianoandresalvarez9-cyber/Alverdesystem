-- RF-03: unir marcas, rubros y etiquetas, y asignarlas a productos en bloque.
begin;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f031', 'rf03-admin@test'),
  ('00000000-0000-0000-0000-00000000f032', 'rf03-employee@test'),
  ('00000000-0000-0000-0000-00000000f033', 'rf03-other-employee@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-00000000f031';

insert into public.brands (id, name) values
  ('00000000-0000-0000-0000-00000000f0b1', 'RF03 Arcor'),
  ('00000000-0000-0000-0000-00000000f0b2', 'RF03 ARCOR S.A.'),
  ('00000000-0000-0000-0000-00000000f0b3', 'RF03 archivada');
update public.brands set archived_at = now() where id = '00000000-0000-0000-0000-00000000f0b3';
insert into public.categories (id, name) values
  ('00000000-0000-0000-0000-00000000f0c1', 'RF03 Granos'),
  ('00000000-0000-0000-0000-00000000f0c2', 'RF03 Legumbres');
insert into public.categories (id, name, parent_id) values
  ('00000000-0000-0000-0000-00000000f0c3', 'RF03 Lentejas', '00000000-0000-0000-0000-00000000f0c2');
insert into public.category_price_multipliers (category_id, multiplier) values
  ('00000000-0000-0000-0000-00000000f0c2', 2.5);
insert into public.labels (id, name) values
  ('00000000-0000-0000-0000-00000000f0e1', 'RF03 Sin TACC'),
  ('00000000-0000-0000-0000-00000000f0e2', 'RF03 Sin gluten');
insert into public.products (id, name, base_unit, brand_id, category_id) values
  ('00000000-0000-0000-0000-00000000f0a1', 'RF03 p1', 'unit', '00000000-0000-0000-0000-00000000f0b2', '00000000-0000-0000-0000-00000000f0c2'),
  ('00000000-0000-0000-0000-00000000f0a2', 'RF03 p2', 'unit', '00000000-0000-0000-0000-00000000f0b2', '00000000-0000-0000-0000-00000000f0c1'),
  ('00000000-0000-0000-0000-00000000f0a3', 'RF03 p3', 'unit', null, null);
insert into public.product_labels (product_id, label_id) values
  ('00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-00000000f0e2'),
  ('00000000-0000-0000-0000-00000000f0a2', '00000000-0000-0000-0000-00000000f0e1'),
  ('00000000-0000-0000-0000-00000000f0a2', '00000000-0000-0000-0000-00000000f0e2');

select is(has_function_privilege('anon', 'public.merge_classifier(text, uuid, uuid)', 'execute'), false, 'anon no puede unir');
select is(has_function_privilege('anon', 'public.assign_classifier(text, uuid, uuid[], boolean)', 'execute'), false, 'anon no puede asignar en bloque');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f032';
set role authenticated;
select throws_ok($$select public.merge_classifier('brand', '00000000-0000-0000-0000-00000000f0b2', '00000000-0000-0000-0000-00000000f0b1')$$,
  '42501', null, 'Empleado no puede unir marcas');
select throws_ok($$select public.assign_classifier('brand', '00000000-0000-0000-0000-00000000f0b1', array['00000000-0000-0000-0000-00000000f0a3']::uuid[])$$,
  '42501', null, 'Empleado no puede asignar en bloque');
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f033';
set role authenticated;
select throws_ok($$select public.merge_classifier('label', '00000000-0000-0000-0000-00000000f0e2', '00000000-0000-0000-0000-00000000f0e1')$$,
  '42501', null, 'Otro empleado tampoco puede unir etiquetas');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f031';
set role authenticated;

-- Validaciones
select throws_ok($$select public.merge_classifier('brand', '00000000-0000-0000-0000-00000000f0b1', '00000000-0000-0000-0000-00000000f0b1')$$,
  '22023', null, 'No se une una marca consigo misma');
select throws_ok($$select public.merge_classifier('brand', '00000000-0000-0000-0000-00000000f0b2', '00000000-0000-0000-0000-00000000f0b3')$$,
  'P0002', null, 'No se une hacia una marca archivada');
select throws_ok($$select public.merge_classifier('rubro', '00000000-0000-0000-0000-00000000f0c1', '00000000-0000-0000-0000-00000000f0c2')$$,
  '22023', null, 'Tipo inválido se rechaza');
select throws_ok($$select public.merge_classifier('category', '00000000-0000-0000-0000-00000000f0c2', '00000000-0000-0000-0000-00000000f0c3')$$,
  '22023', null, 'No se une un rubro dentro de su propio subrubro');

-- Unir marcas: "ARCOR S.A." → "Arcor"
select is(public.merge_classifier('brand', '00000000-0000-0000-0000-00000000f0b2', '00000000-0000-0000-0000-00000000f0b1'), 2,
  'Unir marcas devuelve cuántos productos se movieron');
select is((select count(*)::int from public.products where brand_id = '00000000-0000-0000-0000-00000000f0b1'), 2,
  'Los productos quedaron en la marca de destino');
select isnt((select archived_at from public.brands where id = '00000000-0000-0000-0000-00000000f0b2'), null,
  'La marca unida queda archivada, no borrada');

-- Unir rubros: "Legumbres" (con subrubro y multiplicador) → "Granos"
select is(public.merge_classifier('category', '00000000-0000-0000-0000-00000000f0c2', '00000000-0000-0000-0000-00000000f0c1'), 1,
  'Unir rubros mueve el producto que estaba en Legumbres');
select is((select parent_id from public.categories where id = '00000000-0000-0000-0000-00000000f0c3'), '00000000-0000-0000-0000-00000000f0c1'::uuid,
  'El subrubro pasa a colgar del rubro de destino');
select is((select count(*)::int from public.category_price_multipliers where category_id = '00000000-0000-0000-0000-00000000f0c2'), 0,
  'El multiplicador del rubro unido se descarta');
select isnt((select archived_at from public.categories where id = '00000000-0000-0000-0000-00000000f0c2'), null,
  'El rubro unido queda archivado');

-- Unir etiquetas: "Sin gluten" → "Sin TACC" (p2 ya tenía las dos: no se duplica)
select is(public.merge_classifier('label', '00000000-0000-0000-0000-00000000f0e2', '00000000-0000-0000-0000-00000000f0e1'), 2,
  'Unir etiquetas informa los productos que tenían la etiqueta unida');
select results_eq(
  $$select product_id from public.product_labels where label_id = '00000000-0000-0000-0000-00000000f0e1' order by product_id$$,
  $$values ('00000000-0000-0000-0000-00000000f0a1'::uuid), ('00000000-0000-0000-0000-00000000f0a2'::uuid)$$,
  'Los productos quedan con la etiqueta de destino, sin duplicados');
select is((select count(*)::int from public.product_labels where label_id = '00000000-0000-0000-0000-00000000f0e2'), 0,
  'La etiqueta unida no queda asignada a nadie');

-- Asignar en bloque
select is(public.assign_classifier('brand', '00000000-0000-0000-0000-00000000f0b1',
  array['00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-00000000f0a3']::uuid[]), 1,
  'Asignar marca en bloque cuenta solo los productos que cambiaron');
select is((select brand_id from public.products where id = '00000000-0000-0000-0000-00000000f0a3'), '00000000-0000-0000-0000-00000000f0b1'::uuid,
  'El producto sin marca quedó con la marca asignada');
select is(public.assign_classifier('label', '00000000-0000-0000-0000-00000000f0e1',
  array['00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-00000000f0a2', '00000000-0000-0000-0000-00000000f0a3']::uuid[]), 1,
  'Asignar etiqueta en bloque agrega solo donde faltaba');
select is(public.assign_classifier('label', '00000000-0000-0000-0000-00000000f0e1',
  array['00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-00000000f0a3']::uuid[], true), 2,
  'Quitar etiqueta en bloque');
select throws_ok($$select public.assign_classifier('category', '00000000-0000-0000-0000-00000000f0c1', array[]::uuid[])$$,
  '22023', null, 'Asignar sin productos se rechaza');
reset role;

select * from finish();
rollback;
