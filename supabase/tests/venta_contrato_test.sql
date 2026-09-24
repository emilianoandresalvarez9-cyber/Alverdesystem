-- Tests de 20260923110000_contrato_venta.sql (process_offline_sale v2 y shift_totals).
begin;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'emp@test'),
  ('00000000-0000-0000-0000-0000000000e2', 'emp2@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-0000000000a1';

insert into public.branches (id, name) values ('00000000-0000-0000-0000-000000000b01', 'Central');
insert into public.registers (id, branch_id, name) values ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000b01', 'Caja 1');
insert into public.registers (id, branch_id, name) values ('00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-000000000b01', 'Caja 2');
insert into public.cash_shifts (id, register_id, user_id) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-0000000000e2');
insert into public.customers (id, name) values ('00000000-0000-0000-0000-0000000000d1', 'Cliente fiado');

-- Producto con vida útil de 5 días una vez abierto.
insert into public.products (id, name, base_unit, open_shelf_life_days) values ('00000000-0000-0000-0000-0000000000f1', 'Nueces', 'unit', 5);
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'Bolsa 250 g', 1, 1500);
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price)
  values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f1', 'Nueces granel por kg', 1000, 12000);
-- Lote A: fábrica vence en 1 año, pero se abrió hace 2 días → vence efectivamente en 3 días.
-- Lote B: fábrica vence en 30 días, cerrado. El FEFO viejo (por fábrica) elegía B primero.
insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, manufacturer_expiry_date, opened_at, status, received_at) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000c1', 10, 2, 100, current_date + 365, now() - interval '2 days', 'open', now() - interval '10 days'),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-0000000000c1', 10, 10, 100, current_date + 30, null, 'open', now() - interval '5 days');

select has_column('public', 'employee_catalog', 'sold_by_weight', 'La vista de empleado expone sold_by_weight');
select is((select sold_by_weight from public.product_presentations where id = '00000000-0000-0000-0000-0000000000c2'), false,
  'sold_by_weight arranca en false para filas nuevas (el relleno por nombre corre solo al migrar)');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;

-- P5 · Medio de pago inválido: ya no se convierte en efectivo en silencio.
select throws_ok($$select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'card', 'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 1, 'unitPrice', 1500)))))$$,
  '22023', null, 'P5: medio de pago "card" se rechaza');
select throws_ok($$select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'credit', 'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 1, 'unitPrice', 1500)))))$$,
  '22023', null, 'RF-46: venta fiada sin cliente se rechaza');
select throws_ok($$select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'items', '[]'::jsonb)))$$,
  '22023', null, 'Venta sin productos se rechaza');
select throws_ok($$select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000502', 'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 1, 'unitPrice', 1500)))))$$,
  '42501', null, 'No se puede vender en el turno de otro cajero');
select throws_ok($$select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', gen_random_uuid(), 'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 1, 'unitPrice', 1500)))))$$,
  'P0002', null, 'Turno todavía no sincronizado: error reintentable');

-- Venta fiada de 3 bolsas; la caja informa un total manipulado de 1.
select ok(public.process_offline_sale(jsonb_build_object(
  'localId', '00000000-0000-0000-0000-000000007001', 'deviceId', '00000000-0000-0000-0000-000000007777', 'kind', 'sale', 'createdAt', now(),
  'payload', jsonb_build_object('paymentMethod', 'credit', 'customerId', '00000000-0000-0000-0000-0000000000d1', 'shiftId', '00000000-0000-0000-0000-000000000501', 'totalAmount', 1,
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 3, 'unitPrice', 1500))))),
  'Venta fiada válida se procesa');
-- Reintento idéntico (misma caja, mismo localId).
select ok(public.process_offline_sale(jsonb_build_object(
  'localId', '00000000-0000-0000-0000-000000007001', 'deviceId', '00000000-0000-0000-0000-000000007777', 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'credit', 'customerId', '00000000-0000-0000-0000-0000000000d1', 'shiftId', '00000000-0000-0000-0000-000000000501',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 3, 'unitPrice', 1500))))),
  'El reintento devuelve true');
reset role;

select is((select count(*)::int from public.sales where local_id = '00000000-0000-0000-0000-000000007001'), 1, 'RF-35: el reintento no duplica la venta');
select is((select payment_method::text from public.sales where local_id = '00000000-0000-0000-0000-000000007001'), 'credit', 'P5: el medio de pago se guarda tal cual');
select is((select total_amount from public.sales where local_id = '00000000-0000-0000-0000-000000007001'), 4500.00::numeric, 'P5: el total lo calcula el servidor (3 × 1500)');
select is((select count(*)::int from public.stock_warnings w join public.sales s on s.id = w.sale_id where s.local_id = '00000000-0000-0000-0000-000000007001' and w.lot_id is null), 1,
  'El total manipulado queda marcado para revisión');
select is((select amount from public.credit_movements where local_id = '00000000-0000-0000-0000-000000007001' and kind = 'charge'), 4500.00::numeric,
  'RF-46: la venta fiada genera un cargo por el total');
select is((select register_id from public.sales where local_id = '00000000-0000-0000-0000-000000007001'), '00000000-0000-0000-0000-000000000b02'::uuid,
  'La venta hereda caja y sucursal del turno');
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-00000000a001'), 0.000::numeric,
  'RF-08/09: primero se vacía el lote con vencimiento EFECTIVO más próximo');
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-00000000a002'), 9.000::numeric,
  'RF-09: el resto sale del siguiente lote');
select is((select sum(quantity) from public.stock_movements where kind = 'sale' and reason like 'Venta 00000000-0000-0000-0000-000000007001%'), -3.000::numeric,
  'RF-37: la venta deja movimientos de stock que suman lo vendido');

-- RF-38 · Vender más de lo que hay: no se bloquea, queda en negativo y marcado.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
  'payload', jsonb_build_object('paymentMethod', 'qr', 'shiftId', '00000000-0000-0000-0000-000000000501',
    'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 12, 'unitPrice', 1500)))));
select results_eq($$select payment_method::text, sales_count, total from public.shift_totals('00000000-0000-0000-0000-000000000501')$$,
  $$values ('qr'::text, 1::bigint, 18000.00::numeric), ('credit'::text, 1::bigint, 4500.00::numeric)$$,
  'RF-32: totales del turno separados por medio de pago');
reset role;
select is((select sum(current_quantity) from public.stock_lots where presentation_id = '00000000-0000-0000-0000-0000000000c1'), -3.000::numeric,
  'RF-38: el stock queda negativo en vez de bloquear la venta');


-- P0-03 Precios anómalos o negativos fallan
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;

select throws_ok(
  $$
    select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
      'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000501',
        'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 1, 'unitPrice', -50)))
    ))
  $$,
  '22023',
  'El precio unitario no puede ser negativo.',
  'No permite precios unitarios negativos (QA P0-03)'
);

select throws_ok(
  $$
    select public.process_offline_sale(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'sale',
      'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000501',
        'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 0, 'unitPrice', 100)))
    ))
  $$,
  '22023',
  'La cantidad no puede ser menor o igual a cero.',
  'No permite cantidad menor o igual a cero'
);

-- Venta con precio legítimo modificado genera alerta pero pasa
select ok(
  public.process_offline_sale(jsonb_build_object('localId', '80a92d8f-7f55-430c-9f6b-80a22a362fcc', 'deviceId', gen_random_uuid(), 'kind', 'sale',
    'payload', jsonb_build_object('paymentMethod', 'cash', 'shiftId', '00000000-0000-0000-0000-000000000501', 'totalAmount', 10,
      'items', jsonb_build_array(jsonb_build_object('presentationId', '00000000-0000-0000-0000-0000000000c1', 'quantity', 1, 'unitPrice', 10)))
  )),
  'Acepta venta con precio diferente al catálogo (escenario offline válido)'
);

reset role;
select is(
  (select count(*) from public.stock_warnings where message like 'Diferencia de precio en presentación%' and sale_id = (select id from public.sales where local_id = '80a92d8f-7f55-430c-9f6b-80a22a362fcc'))::integer,
  1,
  'Generó alerta de stock_warnings por diferencia de precio (QA P0-03)'
);


select * from finish();
rollback;
