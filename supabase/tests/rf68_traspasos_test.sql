-- RF-68: traspasos entre sucursales, solo administradora, en una operación y trazables.
begin;
select plan(26);

insert into public.branches (id, name, created_at) values
  ('00000000-0000-0000-0000-0000000068a0', 'Centro', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000068b0', 'Norte', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000068c0', 'Cerrada', now());
update public.branches set archived_at = now() where id = '00000000-0000-0000-0000-0000000068c0';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000006801', 'tr-admin@test'),
  ('00000000-0000-0000-0000-000000006802', 'tr-emp@test'),
  ('00000000-0000-0000-0000-000000006803', 'tr-emp2@test');
update public.profiles set role = 'administrator', display_name = 'Hija A' where id = '00000000-0000-0000-0000-000000006801';
update public.profiles set branch_id = '00000000-0000-0000-0000-0000000068a0' where id = '00000000-0000-0000-0000-000000006802';
update public.profiles set branch_id = '00000000-0000-0000-0000-0000000068b0' where id = '00000000-0000-0000-0000-000000006803';

insert into public.suppliers (id, name) values ('00000000-0000-0000-0000-0000000068e0', 'TR proveedor');
insert into public.products (id, name, base_unit, open_shelf_life_days) values ('00000000-0000-0000-0000-0000000068d1', 'TR almendras', 'gram', 30);
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price, sold_by_weight) values
  ('00000000-0000-0000-0000-0000000068d2', '00000000-0000-0000-0000-0000000068d1', 'Granel', 1, 16, true),
  ('00000000-0000-0000-0000-0000000068d3', '00000000-0000-0000-0000-0000000068d1', 'Bolsa 250 g', 250, 4200, false);
-- Centro: 20 bolsas (lote cerrado de fábrica) y una bolsa de granel abierta de 25 kg.
insert into public.stock_lots (id, presentation_id, supplier_id, initial_quantity, current_quantity, purchase_cost, status, manufacturer_expiry_date, received_at, branch_id) values
  ('00000000-0000-0000-0000-0000000068f1', '00000000-0000-0000-0000-0000000068d3', '00000000-0000-0000-0000-0000000068e0', 20, 20, 2100, 'open', current_date + 90, now() - interval '5 days', '00000000-0000-0000-0000-0000000068a0');
insert into public.stock_lots (id, presentation_id, supplier_id, initial_quantity, current_quantity, purchase_cost, status, opened_at, received_at, branch_id) values
  ('00000000-0000-0000-0000-0000000068f2', '00000000-0000-0000-0000-0000000068d2', '00000000-0000-0000-0000-0000000068e0', 25000, 25000, 8, 'open', now() - interval '3 days', now() - interval '10 days', '00000000-0000-0000-0000-0000000068a0');

select is(has_function_privilege('anon', 'public.transfer_stock(uuid, uuid, numeric, text, uuid)', 'execute'), false, 'anon no traspasa');
select is(has_table_privilege('anon', 'public.stock_transfers', 'select'), false, 'anon no lee traspasos');

-- Empleados: no pueden traspasar, ni desde su sucursal (RF-68: solo administradora).
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006802';
set role authenticated;
select throws_ok($$select public.transfer_stock('00000000-0000-0000-0000-0000000068f1', '00000000-0000-0000-0000-0000000068b0', 5)$$,
  '42501', null, 'La empleada de Centro no traspasa, ni siquiera desde su sucursal');
select is((select count(*)::int from public.stock_transfers), 0, 'Empleada no ve traspasos');
select is((select count(*)::int from public.stock_transfers_list()), 0, 'Ni por la función de historial');
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006803';
set role authenticated;
select throws_ok($$select public.transfer_stock('00000000-0000-0000-0000-0000000068f1', '00000000-0000-0000-0000-0000000068b0', 5)$$,
  '42501', null, 'La empleada de Norte tampoco');
update public.stock_lots set branch_id = '00000000-0000-0000-0000-0000000068b0' where id = '00000000-0000-0000-0000-0000000068f1';
reset role;
select is((select branch_id from public.stock_lots where id = '00000000-0000-0000-0000-0000000068f1'), '00000000-0000-0000-0000-0000000068a0'::uuid,
  'Ni moviendo el lote a mano: la empleada no puede cambiarle la sucursal');

-- Administradora: validaciones.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006801';
set role authenticated;
select throws_ok($$select public.transfer_stock('00000000-0000-0000-0000-0000000068f1', '00000000-0000-0000-0000-0000000068b0', 0)$$,
  '22023', null, 'Cantidad cero se rechaza');
select throws_ok($$select public.transfer_stock('00000000-0000-0000-0000-0000000068f1', '00000000-0000-0000-0000-0000000068b0', 21)$$,
  '22023', null, 'No se traspasa más de lo que hay');
select throws_ok($$select public.transfer_stock('00000000-0000-0000-0000-0000000068f1', '00000000-0000-0000-0000-0000000068a0', 1)$$,
  '22023', null, 'No se traspasa a la misma sucursal');
select throws_ok($$select public.transfer_stock('00000000-0000-0000-0000-0000000068f1', '00000000-0000-0000-0000-0000000068c0', 1)$$,
  'P0002', null, 'No se traspasa a una sucursal archivada');

-- Traspaso de 8 bolsas de Centro a Norte.
create temp table tr_new_lot as
  select public.transfer_stock('00000000-0000-0000-0000-0000000068f1', '00000000-0000-0000-0000-0000000068b0', 8, 'Pedido de Norte',
    '00000000-0000-0000-0000-0000000068aa') as id;
select is(public.transfer_stock('00000000-0000-0000-0000-0000000068f1', '00000000-0000-0000-0000-0000000068b0', 8, 'Pedido de Norte',
    '00000000-0000-0000-0000-0000000068aa'), (select id from tr_new_lot),
  'Reintentar el mismo traspaso devuelve el mismo lote y no descuenta dos veces');
reset role;

select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-0000000068f1'), 12::numeric, 'Centro: 20 − 8 = 12');
select results_eq(
  $$select branch_id, presentation_id, supplier_id, current_quantity, purchase_cost, manufacturer_expiry_date, received_at
    from public.stock_lots where id = (select id from tr_new_lot)$$,
  $$select '00000000-0000-0000-0000-0000000068b0'::uuid, presentation_id, supplier_id, 8::numeric(14,3), purchase_cost, manufacturer_expiry_date, received_at
    from public.stock_lots where id = '00000000-0000-0000-0000-0000000068f1'$$,
  'El lote nuevo está en Norte con 8, mismo producto, proveedor, costo, vencimiento e ingreso');
select results_eq(
  $$select kind::text, quantity, branch_id from public.stock_movements
    where lot_id in ('00000000-0000-0000-0000-0000000068f1', (select id from tr_new_lot)) and kind = 'transfer' order by quantity$$,
  $$values ('transfer', -8::numeric, '00000000-0000-0000-0000-0000000068a0'::uuid), ('transfer', 8::numeric, '00000000-0000-0000-0000-0000000068b0'::uuid)$$,
  'Dos movimientos de tipo traspaso: sale de Centro y entra en Norte');
select is((select sum(quantity) from public.stock_movements where kind = 'transfer'
  and lot_id in ('00000000-0000-0000-0000-0000000068f1', (select id from tr_new_lot))), 0::numeric,
  'El traspaso no crea ni destruye stock');
select is((select count(*)::int from public.stock_transfers where local_id = '00000000-0000-0000-0000-0000000068aa'), 1,
  'Queda un solo registro del traspaso');

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006801';
set role authenticated;
select results_eq(
  $$select product_name, presentation_name, quantity, from_branch_name, to_branch_name, user_name, note
    from public.stock_transfers_list() where from_lot_id = '00000000-0000-0000-0000-0000000068f1'$$,
  $$values ('TR almendras', 'Bolsa 250 g', 8::numeric, 'Centro', 'Norte', 'Hija A', 'Pedido de Norte')$$,
  'El historial dice qué, cuánto, de dónde, a dónde, quién y por qué');
select is((select count(*)::int from public.stock_transfers_list('00000000-0000-0000-0000-0000000068b0')), 1,
  'Filtrando Norte aparece (es destino)');

-- Granel abierto: 5 kg de la bolsa abierta de Centro pasan a Norte, abiertos con la misma fecha de apertura.
create temp table tr_bulk as
  select public.transfer_stock('00000000-0000-0000-0000-0000000068f2', '00000000-0000-0000-0000-0000000068b0', 5000) as id;
reset role;
select is((select opened_at from public.stock_lots where id = (select id from tr_bulk)),
  (select opened_at from public.stock_lots where id = '00000000-0000-0000-0000-0000000068f2'),
  'La parte de una bolsa abierta conserva la fecha de apertura (mismo vencimiento efectivo)');
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-0000000068f2'), 20000::numeric,
  'Centro: quedan 20 kg en la bolsa abierta');

-- Norte ya tiene una bolsa abierta: otro traspaso de bolsa abierta se rechaza y no descuenta (RF-12).
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006801';
set role authenticated;
select throws_ok($$select public.transfer_stock('00000000-0000-0000-0000-0000000068f2', '00000000-0000-0000-0000-0000000068b0', 1000)$$,
  'P0001', null, 'No se crea una segunda bolsa abierta en Norte');
reset role;
select is((select current_quantity from public.stock_lots where id = '00000000-0000-0000-0000-0000000068f2'), 20000::numeric,
  'El intento rechazado no descontó nada en Centro');

-- Traspasar todo el lote lo deja cerrado en origen.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006801';
set role authenticated;
select lives_ok($$select public.transfer_stock('00000000-0000-0000-0000-0000000068f1', '00000000-0000-0000-0000-0000000068b0', 12)$$,
  'Traspasar lo que queda');
reset role;
select results_eq($$select current_quantity, status::text from public.stock_lots where id = '00000000-0000-0000-0000-0000000068f1'$$,
  $$values (0::numeric(14,3), 'closed')$$, 'El lote de origen queda en cero y cerrado');

-- La empleada de Norte ya puede vender lo traspasado (lo ve en su sucursal).
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000006803';
set role authenticated;
select ok((select count(*) from public.employee_stock_lots where id = (select id from tr_new_lot)) = 1,
  'La empleada de Norte ve el lote traspasado');
reset role;

select * from finish();
rollback;
