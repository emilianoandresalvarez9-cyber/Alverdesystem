-- RF-38 (decisión de la dueña, 20/10/2026): el granel no admite faltante.
-- Tests de 20261020120000_rf38_granel_sin_faltante.sql con empleado, otro empleado, administradora y anon.
begin;
select plan(13);

insert into public.branches (id, name) values
  ('00000000-0000-0000-0000-00000000a801', 'Granel central'),
  ('00000000-0000-0000-0000-00000000a802', 'Granel otra');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a803', 'granel-emp@test'),
  ('00000000-0000-0000-0000-00000000a804', 'granel-otro@test'),
  ('00000000-0000-0000-0000-00000000a805', 'granel-admin@test');
update public.profiles set branch_id = '00000000-0000-0000-0000-00000000a801' where id = '00000000-0000-0000-0000-00000000a803';
update public.profiles set branch_id = '00000000-0000-0000-0000-00000000a802' where id = '00000000-0000-0000-0000-00000000a804';
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-00000000a805';

insert into public.products (id, name, base_unit) values
  ('00000000-0000-0000-0000-00000000a806', 'Lentejas', 'gram'),
  ('00000000-0000-0000-0000-00000000a807', 'Alfajor', 'unit'),
  ('00000000-0000-0000-0000-00000000a80e', 'Arroz', 'gram');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price, sold_by_weight) values
  ('00000000-0000-0000-0000-00000000a808', '00000000-0000-0000-0000-00000000a806', 'Granel', 1, 3, true),
  ('00000000-0000-0000-0000-00000000a809', '00000000-0000-0000-0000-00000000a806', 'Bolsa 500 g', 500, 1600, false),
  ('00000000-0000-0000-0000-00000000a80a', '00000000-0000-0000-0000-00000000a807', 'Unidad', 1, 800, false),
  ('00000000-0000-0000-0000-00000000a80f', '00000000-0000-0000-0000-00000000a80e', 'Granel', 1, 2, true);
-- 500 g de lentejas en la central y 5000 g en la otra; 1 alfajor en la central; arroz sin lotes.
insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, branch_id) values
  ('00000000-0000-0000-0000-00000000a80b', '00000000-0000-0000-0000-00000000a808', 500, 500, 1, 'open', '00000000-0000-0000-0000-00000000a801'),
  ('00000000-0000-0000-0000-00000000a80c', '00000000-0000-0000-0000-00000000a808', 5000, 5000, 1, 'open', '00000000-0000-0000-0000-00000000a802'),
  ('00000000-0000-0000-0000-00000000a80d', '00000000-0000-0000-0000-00000000a80a', 1, 1, 400, 'open', '00000000-0000-0000-0000-00000000a801');

-- Venta de una línea, con localId fijo para buscarla después.
create function pg_temp.sale(p_local text, p_presentation text, p_qty numeric, p_price numeric) returns jsonb
language sql as $$
  select jsonb_build_object(
    'localId', p_local, 'deviceId', '00000000-0000-0000-0000-00000000a8ff', 'kind', 'sale',
    'payload', jsonb_build_object('paymentMethod', 'cash', 'items', jsonb_build_array(
      jsonb_build_object('presentationId', p_presentation, 'quantity', p_qty, 'unitPrice', p_price))))
$$;
grant execute on function pg_temp.sale(text, text, numeric, numeric) to authenticated, anon;

-- Empleado de la central.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a803';
set role authenticated;
select lives_ok($$select public.process_offline_sale(pg_temp.sale('00000000-0000-0000-0000-00000000a810', '00000000-0000-0000-0000-00000000a808', 500, 3))$$,
  'Empleado: vender exactamente los 500 g que hay se acepta');
select throws_ok($$select public.process_offline_sale(pg_temp.sale('00000000-0000-0000-0000-00000000a811', '00000000-0000-0000-0000-00000000a808', 1, 3))$$,
  '22023', 'No alcanza el stock a granel de esta presentación en la sucursal: el granel no admite faltante.',
  'Empleado: con el granel en 0, una pesada más se rechaza (antes se aceptaban hasta 10 g de faltante)');
select throws_ok($$select public.process_offline_sale(pg_temp.sale('00000000-0000-0000-0000-00000000a812', '00000000-0000-0000-0000-00000000a80f', 100, 2))$$,
  '22023', 'No hay stock a granel cargado en esta sucursal para esta presentación: la venta a granel no admite faltante.',
  'Empleado: granel sin lotes en la sucursal se rechaza (antes pasaba y sólo anotaba un faltante)');
select lives_ok($$select public.process_offline_sale(pg_temp.sale('00000000-0000-0000-0000-00000000a813', '00000000-0000-0000-0000-00000000a80a', 11, 800))$$,
  'Empleado: lo que no es granel conserva el faltante de hasta 10 unidades');
select lives_ok($$select public.process_offline_sale(pg_temp.sale('00000000-0000-0000-0000-00000000a814', '00000000-0000-0000-0000-00000000a809', 1, 1600))$$,
  'Empleado: una bolsita (no granel) sin lotes se sigue vendiendo y queda como faltante');
reset role;

select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-00000000a80b'), 0::numeric,
  'La pesada rechazada no movió el granel: queda en 0');
select is((select count(*)::int from public.sales where local_id in ('00000000-0000-0000-0000-00000000a811', '00000000-0000-0000-0000-00000000a812')), 0,
  'Las ventas rechazadas no dejan venta parcial');
select is((select count(*)::int from public.missing_items where product_id = '00000000-0000-0000-0000-00000000a80e'), 0,
  'El granel sin lotes rechazado no anota faltante');

-- Otro empleado, de la otra sucursal: su stock no se mezcla con el de la central (RF-65).
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a804';
set role authenticated;
select lives_ok($$select public.process_offline_sale(pg_temp.sale('00000000-0000-0000-0000-00000000a815', '00000000-0000-0000-0000-00000000a808', 4000, 3))$$,
  'Otro empleado: vende granel de su sucursal aunque la central esté en 0');
select throws_ok($$select public.process_offline_sale(pg_temp.sale('00000000-0000-0000-0000-00000000a816', '00000000-0000-0000-0000-00000000a808', 1001, 3))$$,
  '22023', null, 'Otro empleado: tampoco puede pasarse de los 1000 g que le quedan');
reset role;

-- Administradora: el tope vale también para escrituras directas sobre los lotes.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a805';
set role authenticated;
select throws_ok($$update public.stock_lots set current_quantity = -1 where id = '00000000-0000-0000-0000-00000000a80c'$$,
  '22023', null, 'Administradora: no puede dejar el granel en negativo editando el lote');
select lives_ok($$update public.stock_lots set current_quantity = 0 where id = '00000000-0000-0000-0000-00000000a80c'$$,
  'Administradora: sí puede dejarlo en 0');
reset role;

set role anon;
select throws_ok($$select public.process_offline_sale(pg_temp.sale('00000000-0000-0000-0000-00000000a817', '00000000-0000-0000-0000-00000000a808', 1, 3))$$,
  '42501', null, 'anon no puede registrar ventas');
reset role;

select * from finish();
rollback;
