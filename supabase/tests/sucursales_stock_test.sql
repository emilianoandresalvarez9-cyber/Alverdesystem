-- RF-65 a RF-67, RF-70: cada sucursal con su stock; el empleado trabaja solo en la suya.
begin;
select plan(35);

-- Sucursales: A (Centro, la más antigua de la prueba) y B (Norte).
insert into public.branches (id, name, created_at) values
  ('00000000-0000-0000-0000-0000000065a0', 'Centro', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000065b0', 'Norte', now() - interval '1 day');
insert into public.registers (id, branch_id, name) values
  ('00000000-0000-0000-0000-0000000065a1', '00000000-0000-0000-0000-0000000065a0', 'Caja Centro'),
  ('00000000-0000-0000-0000-0000000065b1', '00000000-0000-0000-0000-0000000065b0', 'Caja Norte');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000006501', 'suc-admin@test'),
  ('00000000-0000-0000-0000-000000006502', 'suc-emp-centro@test'),
  ('00000000-0000-0000-0000-000000006503', 'suc-emp-norte@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-000000006501';
update public.profiles set branch_id = '00000000-0000-0000-0000-0000000065a0' where id = '00000000-0000-0000-0000-000000006502';
update public.profiles set branch_id = '00000000-0000-0000-0000-0000000065b0' where id = '00000000-0000-0000-0000-000000006503';

insert into public.cash_shifts (id, register_id, user_id) values
  ('00000000-0000-0000-0000-0000000065c1', '00000000-0000-0000-0000-0000000065b1', '00000000-0000-0000-0000-000000006503');

insert into public.products (id, name, base_unit) values
  ('00000000-0000-0000-0000-0000000065d1', 'SUC almendras', 'unit'),
  ('00000000-0000-0000-0000-0000000065d2', 'SUC lentejas', 'gram');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price, sold_by_weight) values
  ('00000000-0000-0000-0000-0000000065e1', '00000000-0000-0000-0000-0000000065d1', 'Bolsa', 1, 1000, false),
  ('00000000-0000-0000-0000-0000000065e2', '00000000-0000-0000-0000-0000000065d2', 'Granel', 1, 4, true),
  ('00000000-0000-0000-0000-0000000065e3', '00000000-0000-0000-0000-0000000065d2', 'Bolsa 500 g', 500, 2200, false);

-- Mismo producto en las dos sucursales: 5 en Centro, 4 en Norte.
insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, branch_id) values
  ('00000000-0000-0000-0000-0000000065f1', '00000000-0000-0000-0000-0000000065e1', 5, 5, 400, 'open', '00000000-0000-0000-0000-0000000065a0'),
  ('00000000-0000-0000-0000-0000000065f2', '00000000-0000-0000-0000-0000000065e1', 4, 4, 400, 'open', '00000000-0000-0000-0000-0000000065b0');
-- Granel: una bolsa abierta en cada sucursal es válido (RF-12 por sucursal).
insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, opened_at, branch_id) values
  ('00000000-0000-0000-0000-0000000065f3', '00000000-0000-0000-0000-0000000065e2', 25000, 25000, 2, 'open', now(), '00000000-0000-0000-0000-0000000065a0');

-- ---------- Esquema y anon ----------
select col_not_null('public', 'stock_lots', 'branch_id', 'Todo lote tiene sucursal');
select is(has_function_privilege('anon', 'public.current_branch_id()', 'execute'), false, 'anon no consulta la sucursal de trabajo');
select is(has_function_privilege('anon', 'public.resolve_work_branch(uuid)', 'execute'), false, 'anon no resuelve sucursales');

select lives_ok($$insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, opened_at, branch_id)
  values ('00000000-0000-0000-0000-0000000065f4', '00000000-0000-0000-0000-0000000065e2', 25000, 25000, 2, 'open', now(), '00000000-0000-0000-0000-0000000065b0')$$,
  'RF-12 por sucursal: Norte puede tener su propia bolsa abierta de lentejas aunque Centro tenga otra');
select throws_ok($$insert into public.stock_lots (presentation_id, initial_quantity, current_quantity, purchase_cost, status, opened_at, branch_id)
  values ('00000000-0000-0000-0000-0000000065e2', 1000, 1000, 2, 'open', now(), '00000000-0000-0000-0000-0000000065a0')$$,
  'P0001', null, 'RF-12: una segunda bolsa abierta en la MISMA sucursal sigue prohibida');
select throws_ok($$update public.stock_lots set branch_id = '00000000-0000-0000-0000-0000000065b0' where id = '00000000-0000-0000-0000-0000000065f1'$$,
  '42501', null, 'Un lote no cambia de sucursal por UPDATE: eso es un traspaso');

-- ---------- Venta en Norte: solo toca lotes de Norte (RF-65) ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006503';
set role authenticated;
select is(public.current_branch_id(), '00000000-0000-0000-0000-0000000065b0'::uuid, 'La empleada de Norte trabaja en Norte');
select ok(public.process_offline_sale(jsonb_build_object('localId', '00000000-0000-0000-0000-0000000065aa', 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-0000000065c1',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000065e1', 'quantity', 3, 'unitPrice', 1000))))),
  'Venta de 3 en la caja de Norte');
reset role;
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-0000000065f2'), 1::numeric, 'Norte: 4 − 3 = 1');
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-0000000065f1'), 5::numeric, 'Centro no se toca: sigue en 5');
select is((select branch_id from public.sales where local_id = '00000000-0000-0000-0000-0000000065aa'), '00000000-0000-0000-0000-0000000065b0'::uuid,
  'La venta queda registrada en Norte');
select is((select count(*)::int from public.stock_movements where reason = 'Venta 00000000-0000-0000-0000-0000000065aa' and branch_id = '00000000-0000-0000-0000-0000000065b0'), 1,
  'El movimiento de stock lleva la sucursal');

-- Vender más de lo que hay en Norte: negativo en Norte aunque Centro tenga (RF-38 + RF-65).
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006503';
set role authenticated;
select ok(public.process_offline_sale(jsonb_build_object('localId', '00000000-0000-0000-0000-0000000065ab', 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-0000000065c1',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000065e1', 'quantity', 3, 'unitPrice', 1000))))),
  'Venta de 3 con solo 1 en Norte no se bloquea');
reset role;
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-0000000065f2'), -2::numeric, 'Norte queda en −2');
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-0000000065f1'), 5::numeric, 'Centro sigue en 5: no se usa stock de otro local');

-- Venta sin turno: descuenta de la sucursal del usuario.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006502';
set role authenticated;
select ok(public.process_offline_sale(jsonb_build_object('localId', '00000000-0000-0000-0000-0000000065ac', 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000065e1', 'quantity', 2, 'unitPrice', 1000))))),
  'Venta sin turno de la empleada de Centro');
reset role;
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-0000000065f1'), 3::numeric, 'Sin turno descuenta en Centro, la sucursal de la empleada');

-- ---------- Empleado: solo su sucursal (RF-66) ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006502';
set role authenticated;
select throws_ok($$select public.adjust_stock('00000000-0000-0000-0000-0000000065f2', '00000000-0000-0000-0000-0000000065d1', 'adjustment', 1, 'conteo', null, false)$$,
  '42501', null, 'La empleada de Centro no ajusta un lote de Norte');
select lives_ok($$select public.adjust_stock('00000000-0000-0000-0000-0000000065f1', '00000000-0000-0000-0000-0000000065d1', 'adjustment', 1, 'conteo', null, false)$$,
  'La empleada de Centro ajusta un lote de Centro');
select throws_ok($$select public.quick_restock('00000000-0000-0000-0000-0000000065e1', '00000000-0000-0000-0000-0000000065d1', 10, null, null, '00000000-0000-0000-0000-0000000065b0')$$,
  '42501', null, 'La empleada de Centro no ingresa mercadería en Norte');
create temp table suc_emp_lot as
  select public.quick_restock('00000000-0000-0000-0000-0000000065e1', '00000000-0000-0000-0000-0000000065d1', 10, null) as id;
select is((select count(*)::int from public.employee_stock_lots where branch_id <> '00000000-0000-0000-0000-0000000065a0' and product_name like 'SUC%'), 0,
  'La vista de stock de la empleada no muestra lotes de otra sucursal');
select ok((select count(*) from public.employee_stock_lots where product_name like 'SUC%') > 0, 'Pero sí los de la suya');
reset role;
select is((select branch_id from public.stock_lots where id = (select id from suc_emp_lot)),
  '00000000-0000-0000-0000-0000000065a0'::uuid, 'Sin indicar sucursal, el ingreso de la empleada va a su sucursal');

-- Fraccionar en Norte (empleada de Norte): las bolsitas nacen en Norte.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006503';
set role authenticated;
select lives_ok($$select public.fraction_stock('00000000-0000-0000-0000-0000000065f4', '00000000-0000-0000-0000-0000000065e3', 2, 1000, 0, 24000, 'open')$$,
  'La empleada de Norte fracciona la bolsa de Norte');
select throws_ok($$select public.fraction_stock('00000000-0000-0000-0000-0000000065f3', '00000000-0000-0000-0000-0000000065e3', 2, 1000, 0, 24000, 'open')$$,
  '42501', null, 'Pero no la bolsa de Centro');
reset role;
select is((select branch_id from public.stock_lots where presentation_id = '00000000-0000-0000-0000-0000000065e3'), '00000000-0000-0000-0000-0000000065b0'::uuid,
  'Las bolsitas fraccionadas quedan en la sucursal del lote de origen');

-- ---------- Administración: cualquier sucursal (RF-66) ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006501';
set role authenticated;
create temp table suc_admin_lot as
  select public.quick_restock('00000000-0000-0000-0000-0000000065e1', '00000000-0000-0000-0000-0000000065d1', 7, null, null, '00000000-0000-0000-0000-0000000065b0') as id;
select is((select branch_id from public.stock_lots where id = (select id from suc_admin_lot)),
  '00000000-0000-0000-0000-0000000065b0'::uuid, 'La administradora ingresa mercadería en la sucursal que eligió');
select lives_ok($$select public.adjust_stock('00000000-0000-0000-0000-0000000065f2', '00000000-0000-0000-0000-0000000065d1', 'adjustment', 2, 'conteo Norte', null, false)$$,
  'La administradora ajusta un lote de cualquier sucursal');
select ok((select count(distinct branch_id) from public.employee_stock_lots where product_name like 'SUC%') = 2,
  'La administradora ve lotes de las dos sucursales');
select is((select branch_name from public.employee_stock_lots where id = '00000000-0000-0000-0000-0000000065f2'), 'Norte',
  'Con el nombre de la sucursal');
select is((select count(*)::int from public.stock_warnings_for_review(false, '00000000-0000-0000-0000-0000000065b0') where product_name = 'SUC almendras'), 1,
  'RF-70: el caso de stock negativo aparece al filtrar Norte');
select is((select count(*)::int from public.stock_warnings_for_review(false, '00000000-0000-0000-0000-0000000065a0') where product_name = 'SUC almendras'), 0,
  'y no al filtrar Centro');
reset role;

-- ---------- Faltantes por sucursal (RF-70) ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006502';
set role authenticated;
select ok(public.apply_offline_operation(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'missing_item',
  'payload', jsonb_build_object('productId', '00000000-0000-0000-0000-0000000065d1'))), 'Centro avisa que faltan almendras');
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006503';
set role authenticated;
select ok(public.apply_offline_operation(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'missing_item',
  'payload', jsonb_build_object('productId', '00000000-0000-0000-0000-0000000065d1'))), 'Norte también avisa');
reset role;
select is((select count(*)::int from public.missing_items where product_id = '00000000-0000-0000-0000-0000000065d1' and not resolved
  and branch_id in ('00000000-0000-0000-0000-0000000065a0', '00000000-0000-0000-0000-0000000065b0') and note is null), 2,
  'Un faltante abierto por sucursal: no se pisan entre locales');

select * from finish();
rollback;
