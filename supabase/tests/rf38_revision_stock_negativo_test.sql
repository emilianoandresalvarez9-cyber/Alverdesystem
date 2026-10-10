-- RF-38: la venta con stock insuficiente no se bloquea; queda marcada y la administradora la revisa.
begin;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f381', 'rf38-admin@test'),
  ('00000000-0000-0000-0000-00000000f382', 'rf38-employee@test'),
  ('00000000-0000-0000-0000-00000000f383', 'rf38-other-employee@test');
update public.profiles set role = 'administrator', display_name = 'Admin RF38' where id = '00000000-0000-0000-0000-00000000f381';
update public.profiles set display_name = 'Cajera RF38' where id = '00000000-0000-0000-0000-00000000f382';

insert into public.branches (id, name) values ('00000000-0000-0000-0000-00000000f3b1', 'RF38 sucursal');
insert into public.registers (id, branch_id, name) values ('00000000-0000-0000-0000-00000000f3b2', '00000000-0000-0000-0000-00000000f3b1', 'Caja RF38');
insert into public.cash_shifts (id, register_id, user_id)
  values ('00000000-0000-0000-0000-00000000f3c1', '00000000-0000-0000-0000-00000000f3b2', '00000000-0000-0000-0000-00000000f382');
insert into public.products (id, name, base_unit) values ('00000000-0000-0000-0000-00000000f3a1', 'RF38 garrapiñada', 'unit');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price)
  values ('00000000-0000-0000-0000-00000000f3e1', '00000000-0000-0000-0000-00000000f3a1', 'Bolsita 150 g', 1, 900);
-- Un solo lote con 2 unidades: la caja vende 5 sin conexión.
insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, branch_id)
  values ('00000000-0000-0000-0000-00000000f3d1', '00000000-0000-0000-0000-00000000f3e1', 2, 2, 100, 'open', '00000000-0000-0000-0000-00000000f3b1');

-- La cajera vende más de lo que hay.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f382';
set role authenticated;
select ok(public.process_offline_sale(jsonb_build_object(
  'localId', '00000000-0000-0000-0000-00000000f3f1', 'deviceId', gen_random_uuid(), 'kind', 'sale', 'createdAt', now(),
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-00000000f3c1', 'totalAmount', 4500,
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-00000000f3e1', 'quantity', 5, 'unitPrice', 900))))),
  'RF-38: la venta con stock insuficiente no se bloquea');
select is((select count(*)::int from public.stock_warnings_for_review(false)), 0,
  'Empleado no ve la lista de revisión');
select throws_ok($$select public.resolve_stock_warning(
  (select id from public.stock_warnings where lot_id = '00000000-0000-0000-0000-00000000f3d1' limit 1), 'yo lo arreglo')$$,
  '42501', null, 'Empleado no puede marcar un caso como revisado');
reset role;
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-00000000f3d1'), -3::numeric,
  'El lote queda en negativo');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f383';
set role authenticated;
select is((select count(*)::int from public.stock_warnings_for_review(true)), 0,
  'Otro empleado tampoco ve la lista, ni con los resueltos');
reset role;

select is(has_function_privilege('anon', 'public.stock_warnings_for_review(boolean, uuid)', 'execute'), false,
  'anon no puede ejecutar la lista de revisión');
select is(has_function_privilege('anon', 'public.resolve_stock_warning(uuid, text)', 'execute'), false,
  'anon no puede resolver casos');

-- La administradora revisa.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f381';
set role authenticated;
select results_eq(
  $$select product_name, presentation_name, lot_current_quantity, sale_total, register_name, sold_by
    from public.stock_warnings_for_review(false) where lot_id = '00000000-0000-0000-0000-00000000f3d1'$$,
  $$values ('RF38 garrapiñada', 'Bolsita 150 g', -3::numeric, 4500::numeric, 'Caja RF38', 'Cajera RF38')$$,
  'La lista muestra producto, lote en negativo, venta, caja y quién vendió');
select matches((select message from public.stock_warnings_for_review(false) where lot_id = '00000000-0000-0000-0000-00000000f3d1'),
  '^Stock negativo: faltaron 3', 'El aviso dice cuánto faltó');
select throws_ok($$select public.resolve_stock_warning(
  (select id from public.stock_warnings where lot_id = '00000000-0000-0000-0000-00000000f3d1'), '   ')$$,
  '22023', null, 'Resolver sin nota se rechaza');
select lives_ok($$select public.resolve_stock_warning(
  (select id from public.stock_warnings where lot_id = '00000000-0000-0000-0000-00000000f3d1'), 'Conteo físico: había 5, se ajustó el lote')$$,
  'La administradora marca el caso como revisado con una nota');
select is((select count(*)::int from public.stock_warnings_for_review(false) where lot_id = '00000000-0000-0000-0000-00000000f3d1'), 0,
  'El caso resuelto desaparece de los pendientes');
select results_eq(
  $$select resolved_by_name, resolution from public.stock_warnings_for_review(true) where lot_id = '00000000-0000-0000-0000-00000000f3d1'$$,
  $$values ('Admin RF38', 'Conteo físico: había 5, se ajustó el lote')$$,
  'Con resueltos incluidos se ve quién lo revisó y qué hizo');
select throws_ok($$select public.resolve_stock_warning(
  (select id from public.stock_warnings where lot_id = '00000000-0000-0000-0000-00000000f3d1'), 'otra vez')$$,
  'P0002', null, 'Un caso ya resuelto no se resuelve dos veces');
select throws_ok($$select public.resolve_stock_warning(gen_random_uuid(), 'nada')$$,
  'P0002', null, 'Un caso inexistente da error');
reset role;

-- Empleado: ni siquiera leyendo la tabla directamente.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f382';
set role authenticated;
select is((select count(*)::int from public.stock_warnings), 0, 'Empleado no lee stock_warnings directamente');
reset role;

select * from finish();
rollback;
