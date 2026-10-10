-- #82 corregido: la masiva redondea el precio POR KILO en presentaciones de balanza (ADR-001, RF-29).
begin;
select plan(7);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000f291', 'rf28b-admin@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-00000000f291';
insert into public.categories (id, name) values ('00000000-0000-0000-0000-00000000f2c9', 'RF28B granos');
insert into public.products (id, name, base_unit, category_id) values
  ('00000000-0000-0000-0000-00000000f2a9', 'RF28B lentejas', 'gram', '00000000-0000-0000-0000-00000000f2c9');
-- Granel a $14.800/kg = $14,80 el gramo; bolsa de 500 g a $7.300.
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price, sold_by_weight) values
  ('00000000-0000-0000-0000-00000000f2e9', '00000000-0000-0000-0000-00000000f2a9', 'Granel', 1, 14.80, true),
  ('00000000-0000-0000-0000-00000000f2e8', '00000000-0000-0000-0000-00000000f2a9', 'Bolsa 500 g', 500, 7300, false);

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f291';
set role authenticated;
select results_eq(
  $$select presentation_name, old_price, new_price, sold_by_weight from public.bulk_update_prices(10, 'category', '00000000-0000-0000-0000-00000000f2c9', false, 100)
    order by presentation_name$$,
  $$values ('Bolsa 500 g', 7300::numeric, 8000::numeric, false), ('Granel', 14.80::numeric, 16.30::numeric, true)$$,
  'Granel: $14.800/kg +10 % = $16.280 → redondeado a $16.300/kg = $16,30 el gramo (no $100 el gramo)');
select is((select new_price from public.bulk_update_prices(10, 'category', '00000000-0000-0000-0000-00000000f2c9', false, null) where sold_by_weight),
  16.28::numeric, 'Sin redondeo a $100, el precio por kilo queda en múltiplo de $10 ($16.280/kg)');
select is((select new_price from public.bulk_update_prices(-99, 'category', '00000000-0000-0000-0000-00000000f2c9', false, 100) where sold_by_weight),
  0.10::numeric, 'Nunca baja de $100 el kilo con redondeo a $100');
select is((select new_price from public.bulk_update_prices(10, 'category', '00000000-0000-0000-0000-00000000f2c9', false, 5) where sold_by_weight),
  16.28::numeric, 'Un redondeo menor a $10 se lleva a $10 por kilo para que el gramo tenga 2 decimales');

select lives_ok($$select * from public.bulk_update_prices(10, 'category', '00000000-0000-0000-0000-00000000f2c9', true, 100)$$, 'Aplicar');
reset role;
select is((select sale_price from public.product_presentations where id = '00000000-0000-0000-0000-00000000f2e9'), 16.30::numeric,
  'El granel queda en $16,30 el gramo');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f291';
set role authenticated;
select results_eq(
  $$select presentation_name, old_price, new_price, sold_by_weight from public.price_batch_changes(
      (select id from public.price_update_batches order by created_at desc limit 1)) order by presentation_name$$,
  $$values ('Bolsa 500 g', 7300::numeric, 8000::numeric, false), ('Granel', 14.80::numeric, 16.30::numeric, true)$$,
  'La lista de reetiquetado indica cuál es de balanza para mostrarlo por kilo');
reset role;

select * from finish();
rollback;
