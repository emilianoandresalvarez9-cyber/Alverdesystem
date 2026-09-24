-- Tests de 20260923140000_balanza_granel.sql (ADR-001).
begin;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'emp@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.branches (id, name) values ('00000000-0000-0000-0000-000000000b01', 'Central');
insert into public.registers (id, branch_id, name) values ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000b01', 'Caja 1');
insert into public.cash_shifts (id, register_id, user_id) values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-0000000000e1');

-- Ejemplos de la dueña: palitos salados en bolsitas de 150 g y 250 g; lentejas a granel.
insert into public.products (id, name, base_unit) values
  ('00000000-0000-0000-0000-0000000000f1', 'Palitos salados', 'gram'),
  ('00000000-0000-0000-0000-0000000000f2', 'Lentejas', 'gram'),
  ('00000000-0000-0000-0000-0000000000f3', 'Alfajor', 'unit');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', '150 g', 150, 900),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f1', '250 g', 250, 1400),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000f2', 'Granel', 1000, 0),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000f3', 'Unidad', 1, 800);

select throws_ok($$update public.product_presentations set sold_by_weight = true where id = '00000000-0000-0000-0000-0000000000c1'$$,
  '23514', null, 'Una bolsita de 150 g no puede ser Balanza (no es por gramo)');
select throws_ok($$update public.product_presentations set sold_by_weight = true, base_quantity = 1 where id = '00000000-0000-0000-0000-0000000000c4'$$,
  '23514', null, 'Un producto por unidad no se vende con balanza');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select throws_ok($$select public.set_presentation_scale('00000000-0000-0000-0000-0000000000c3', true, 3000)$$,
  '42501', null, 'Un empleado no configura la balanza');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select throws_ok($$select public.set_presentation_scale('00000000-0000-0000-0000-0000000000c3', true, 3155)$$,
  '22023', null, 'Un precio por kilo que no es múltiplo de $10 se rechaza');
select throws_ok($$select public.set_presentation_scale('00000000-0000-0000-0000-0000000000c3', true, 3000)$$,
  '22023', null, 'Convertir una presentación de tamaño fijo pide confirmación explícita');
select lives_ok($$select public.set_presentation_scale('00000000-0000-0000-0000-0000000000c3', true, 3000, true)$$,
  'Con confirmación, Lentejas granel queda con Balanza a $3.000/kg');
reset role;

select is((select sale_price from public.product_presentations where id = '00000000-0000-0000-0000-0000000000c3'), 3.00::numeric,
  'Se guarda como $3 por gramo');
select is((select base_quantity from public.product_presentations where id = '00000000-0000-0000-0000-0000000000c3'), 1.000::numeric,
  'La presentación queda por gramo');
select cmp_ok((select count(*)::int from public.product_price_history where presentation_id = '00000000-0000-0000-0000-0000000000c3'), '>=', 1,
  'RF-27: el cambio de precio queda en el historial');
select is((select sold_by_weight from public.employee_catalog where presentation_id = '00000000-0000-0000-0000-0000000000c3'), true,
  'La caja ve la marca Balanza en el catálogo');

-- T-02: una bolsa de 25 kg es un lote de 25.000 g; vender 350 g descuenta 350.
insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, opened_at)
  values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000c3', 25000, 25000, 40000, 'open', now());
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000501',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c3', 'quantity', 350, 'unitPrice', 3)))));
reset role;
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-00000000a001'), 24650.000::numeric,
  'T-02: vender 350 g descuenta 350 g del lote');
select is((select total_amount from public.sales order by created_at desc limit 1), 1050.00::numeric,
  'RF-33: 350 g a $3.000/kg son $1.050');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select throws_ok($$select public.set_presentation_scale('00000000-0000-0000-0000-0000000000c2', true, 5600)$$,
  '22023', null, 'La bolsita de 250 g no se convierte en Balanza sin confirmación');
reset role;

select * from finish();
rollback;
