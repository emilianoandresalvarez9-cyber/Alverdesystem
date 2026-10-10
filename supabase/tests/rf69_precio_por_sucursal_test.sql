-- RF-69: precio base + precio propio opcional por sucursal.
begin;
select plan(24);

insert into public.branches (id, name, created_at) values
  ('00000000-0000-0000-0000-0000000069a0', 'Centro', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000069b0', 'Norte', now() - interval '1 day');
insert into public.registers (id, branch_id, name) values
  ('00000000-0000-0000-0000-0000000069b1', '00000000-0000-0000-0000-0000000069b0', 'Caja Norte');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000006901', 'pr-admin@test'),
  ('00000000-0000-0000-0000-000000006902', 'pr-emp-norte@test'),
  ('00000000-0000-0000-0000-000000006903', 'pr-emp-centro@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-000000006901';
update public.profiles set branch_id = '00000000-0000-0000-0000-0000000069b0' where id = '00000000-0000-0000-0000-000000006902';
update public.profiles set branch_id = '00000000-0000-0000-0000-0000000069a0' where id = '00000000-0000-0000-0000-000000006903';
insert into public.cash_shifts (id, register_id, user_id) values
  ('00000000-0000-0000-0000-0000000069c1', '00000000-0000-0000-0000-0000000069b1', '00000000-0000-0000-0000-000000006902');

insert into public.categories (id, name) values ('00000000-0000-0000-0000-0000000069c9', 'PR rubro');
insert into public.products (id, name, base_unit, category_id) values
  ('00000000-0000-0000-0000-0000000069d1', 'PR almendras', 'gram', '00000000-0000-0000-0000-0000000069c9');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price, sold_by_weight) values
  ('00000000-0000-0000-0000-0000000069e1', '00000000-0000-0000-0000-0000000069d1', 'Bolsa 250 g', 250, 4000, false),
  ('00000000-0000-0000-0000-0000000069e2', '00000000-0000-0000-0000-0000000069d1', 'Granel', 1, 16.00, true);
insert into public.stock_lots (presentation_id, initial_quantity, current_quantity, purchase_cost, status, branch_id) values
  ('00000000-0000-0000-0000-0000000069e1', 50, 50, 2000, 'open', '00000000-0000-0000-0000-0000000069b0');

select is(has_function_privilege('anon', 'public.set_branch_price(uuid, uuid, numeric)', 'execute'), false, 'anon no define precios');
select is(has_table_privilege('anon', 'public.branch_prices', 'select'), false, 'anon no lee precios por sucursal');

-- ---------- Solo administración define precios ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006902';
set role authenticated;
select throws_ok($$select public.set_branch_price('00000000-0000-0000-0000-0000000069e1', '00000000-0000-0000-0000-0000000069b0', 4500)$$,
  '42501', null, 'Empleada no define el precio de su sucursal');
select throws_ok($$insert into public.branch_prices (branch_id, presentation_id, sale_price) values ('00000000-0000-0000-0000-0000000069b0', '00000000-0000-0000-0000-0000000069e1', 1)$$,
  '42501', null, 'Ni escribiendo la tabla directamente');
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006903';
set role authenticated;
select throws_ok($$select public.set_branch_price('00000000-0000-0000-0000-0000000069e1', '00000000-0000-0000-0000-0000000069b0', 1)$$,
  '42501', null, 'Otra empleada tampoco');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006901';
set role authenticated;
select throws_ok($$select public.set_branch_price('00000000-0000-0000-0000-0000000069e1', '00000000-0000-0000-0000-0000000069b0', 4500.005)$$,
  '22023', null, 'Más de dos decimales se rechaza');
select lives_ok($$select public.set_branch_price('00000000-0000-0000-0000-0000000069e1', '00000000-0000-0000-0000-0000000069b0', 4500)$$,
  'La administradora pone $4.500 a la bolsa en Norte');
select lives_ok($$select public.set_branch_price('00000000-0000-0000-0000-0000000069e2', '00000000-0000-0000-0000-0000000069b0', 17.50)$$,
  'y $17.500/kg al granel en Norte');
reset role;

-- ---------- Precio efectivo ----------
select is(public.effective_sale_price('00000000-0000-0000-0000-0000000069e1', '00000000-0000-0000-0000-0000000069b0'), 4500::numeric, 'Norte usa su precio propio');
select is(public.effective_sale_price('00000000-0000-0000-0000-0000000069e1', '00000000-0000-0000-0000-0000000069a0'), 4000::numeric, 'Centro, sin precio propio, usa el base');
select is((select sale_price from public.product_presentations where id = '00000000-0000-0000-0000-0000000069e1'), 4000::numeric, 'El precio base no cambió');

-- La vista del catálogo trae los precios propios (para la caja y la copia sin conexión).
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006903';
set role authenticated;
select is((select branch_prices ->> '00000000-0000-0000-0000-0000000069b0' from public.employee_catalog where presentation_id = '00000000-0000-0000-0000-0000000069e1'),
  '4500.00', 'El catálogo trae el precio de Norte');
select is((select sale_price from public.employee_catalog where presentation_id = '00000000-0000-0000-0000-0000000069e1'), 4000::numeric,
  'y el base aparte');
select ok((select count(*) from public.employee_catalog where to_jsonb(employee_catalog) ? 'purchase_cost') = 0, 'Sin costos (RNF-04)');
reset role;

-- ---------- La venta se controla contra el precio de su sucursal ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006902';
set role authenticated;
select ok(public.process_offline_sale(jsonb_build_object('localId', '00000000-0000-0000-0000-0000000069f1', 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-0000000069c1',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000069e1', 'quantity', 1, 'unitPrice', 4500))))),
  'Venta en Norte a $4.500');
select throws_ok($$select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-0000000069c1',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000069e1', 'quantity', 1, 'unitPrice', 2100)))))$$,
  '22023', null, 'Cobrar menos de la mitad del precio de Norte se rechaza aunque supere la mitad del base');
reset role;
select is((select count(*)::int from public.stock_warnings w join public.sales s on s.id = w.sale_id
  where s.local_id = '00000000-0000-0000-0000-0000000069f1' and w.message like 'Diferencia de precio%'), 0,
  'Cobrar el precio de la sucursal no genera aviso de diferencia');

-- ---------- Historial y masiva por sucursal ----------
select results_eq(
  $$select previous_price, sale_price, branch_id from public.product_price_history
    where presentation_id = '00000000-0000-0000-0000-0000000069e1' and branch_id is not null$$,
  $$values (4000::numeric, 4500::numeric, '00000000-0000-0000-0000-0000000069b0'::uuid)$$,
  'El historial registra el precio propio de Norte (antes regía el base de $4.000)');

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006901';
set role authenticated;
select results_eq(
  $$select presentation_name, old_price, new_price from public.bulk_update_prices(10, 'category', '00000000-0000-0000-0000-0000000069c9', true, 100,
      '00000000-0000-0000-0000-0000000069b0') order by presentation_name$$,
  $$values ('Bolsa 250 g', 4500::numeric, 5000::numeric), ('Granel', 17.50::numeric, 19.30::numeric)$$,
  'Masiva +10 % en Norte parte de los precios de Norte ($17.500/kg → $19.300/kg)');
reset role;
select is((select sale_price from public.product_presentations where id = '00000000-0000-0000-0000-0000000069e1'), 4000::numeric,
  'La masiva de Norte no toca el precio base');
select is(public.effective_sale_price('00000000-0000-0000-0000-0000000069e1', '00000000-0000-0000-0000-0000000069b0'), 5000::numeric,
  'Norte queda en $5.000');
select is((select branch_id from public.price_update_batches order by created_at desc limit 1), '00000000-0000-0000-0000-0000000069b0'::uuid,
  'El lote de la masiva queda registrado como de Norte');

-- Quitar el precio propio: Norte vuelve al base, y queda en el historial.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006901';
set role authenticated;
select lives_ok($$select public.set_branch_price('00000000-0000-0000-0000-0000000069e1', '00000000-0000-0000-0000-0000000069b0', null)$$,
  'Quitar el precio propio de Norte');
reset role;
select is(public.effective_sale_price('00000000-0000-0000-0000-0000000069e1', '00000000-0000-0000-0000-0000000069b0'), 4000::numeric,
  'Norte vuelve a usar el base');

select * from finish();
rollback;
