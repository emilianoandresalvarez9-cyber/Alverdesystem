-- Tests de 20261022180000_fraccionar_remanente_servidor.sql (A-03, RF-14, RF-16).
BEGIN;
SELECT plan(8);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000a301', 'admin-a03@test'),
  ('00000000-0000-0000-0000-00000000a302', 'emp-centro-a03@test'),
  ('00000000-0000-0000-0000-00000000a303', 'emp-norte-a03@test');

UPDATE public.profiles SET role = 'administrator' WHERE id = '00000000-0000-0000-0000-00000000a301';

INSERT INTO public.branches (id, name) VALUES
  ('00000000-0000-0000-0000-00000000b301', 'Centro A03'),
  ('00000000-0000-0000-0000-00000000b302', 'Norte A03');

UPDATE public.profiles SET branch_id = '00000000-0000-0000-0000-00000000b301'
  WHERE id IN ('00000000-0000-0000-0000-00000000a301', '00000000-0000-0000-0000-00000000a302');
UPDATE public.profiles SET branch_id = '00000000-0000-0000-0000-00000000b302'
  WHERE id = '00000000-0000-0000-0000-00000000a303';

INSERT INTO public.registers (id, branch_id, name) VALUES
  ('00000000-0000-0000-0000-00000000c301', '00000000-0000-0000-0000-00000000b301', 'Caja Centro A03');
INSERT INTO public.cash_shifts (id, register_id, user_id) VALUES
  ('00000000-0000-0000-0000-00000000d301', '00000000-0000-0000-0000-00000000c301', '00000000-0000-0000-0000-00000000a302');

INSERT INTO public.products (id, name, base_unit) VALUES
  ('00000000-0000-0000-0000-00000000e301', 'Almendras A03', 'gram');

INSERT INTO public.product_presentations (id, product_id, name, base_quantity, sale_price, sold_by_weight) VALUES
  ('00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000e301', 'Balanza', 1, 20, true),
  ('00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-00000000e301', 'Bolsita 250 g', 250, 5500, false);

INSERT INTO public.stock_lots (
  id, presentation_id, initial_quantity, current_quantity, purchase_cost, opened_at, status, branch_id
) VALUES (
  '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-00000000f301',
  5000, 5000, 10, now(), 'open', '00000000-0000-0000-0000-00000000b301'
);

-- 1. anon no puede ejecutar fraction_stock
SELECT is(
  has_function_privilege('anon', 'public.fraction_stock(uuid, uuid, numeric, numeric, numeric, numeric, public.stock_lot_status)', 'EXECUTE'),
  false,
  'anon no tiene permiso EXECUTE sobre fraction_stock'
);

-- 2. Mientras la empleada tiene abierto el modal (veía 5000 g y calculó newOriginQuantity = 4000 g para 4 bolsitas de 250 g),
--    entra una venta de 300 g en la caja y deja el lote en 4700 g.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a302';
SET role authenticated;

SELECT lives_ok($$
  SELECT public.process_offline_sale(jsonb_build_object(
    'localId', '00000000-0000-0000-0000-000000009301',
    'deviceId', '00000000-0000-0000-0000-000000008301',
    'kind', 'sale',
    'payload', jsonb_build_object(
      'paymentMethod', 'cash',
      'shiftId', '00000000-0000-0000-0000-00000000d301',
      'items', jsonb_build_array(
        jsonb_build_object('presentationId', '00000000-0000-0000-0000-00000000f301', 'quantity', 300, 'unitPrice', 20)
      )
    )
  ))
$$, 'La venta en caja descuenta 300 g de la bolsa abierta antes de confirmar el fraccionamiento');

-- 3. Otro empleado de otra sucursal no puede fraccionar este lote
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a303';
SELECT throws_ok($$
  SELECT public.fraction_stock(
    '00000000-0000-0000-0000-000000001301',
    '00000000-0000-0000-0000-00000000f302',
    4, 1000, 0, 4000, 'open'::public.stock_lot_status
  )
$$, '42501', NULL, 'Un empleado de otra sucursal no puede fraccionar el lote');

-- 4. La empleada de la sucursal envía el fraccionamiento con estado 'open' y p_new_origin_quantity = 4000 (calculado antes de la venta de 300 g):
--    el servidor calcula el remanente real (4700 - 1000 = 3700 g) sin rechazar con 22023.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a302';
SELECT lives_ok($$
  SELECT public.fraction_stock(
    '00000000-0000-0000-0000-000000001301',
    '00000000-0000-0000-0000-00000000f302',
    4, 1000, 0, 4000, 'open'::public.stock_lot_status
  )
$$, 'A-03: con estado open, fraction_stock calcula el remanente con el stock actual del lote aunque haya vendido algo en el medio');

RESET role;

SELECT is(
  (SELECT current_quantity FROM public.stock_lots WHERE id = '00000000-0000-0000-0000-000000001301'),
  3700.000::numeric,
  'El lote de origen queda en 3700 g (5000 - 300 vendidos - 1000 fraccionados)'
);

SELECT is(
  (SELECT current_quantity FROM public.stock_lots WHERE presentation_id = '00000000-0000-0000-0000-00000000f302'),
  4.000::numeric,
  'Se crean las 4 bolsitas de 250 g'
);

-- 5. Si con estado 'open' se envía una merma distinta de 0, el servidor lo sigue rechazando
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a301';
SET role authenticated;
SELECT throws_ok($$
  SELECT public.fraction_stock(
    '00000000-0000-0000-0000-000000001301',
    '00000000-0000-0000-0000-00000000f302',
    2, 500, 10, 3200, 'open'::public.stock_lot_status
  )
$$, '22023', 'El remanente o la merma no coinciden con los valores calculados.',
  'Con estado open no se admite merma distinta de cero');

-- 6. La administradora también puede fraccionar dejando la bolsa abierta aunque mande una foto previa del remanente
SELECT lives_ok($$
  SELECT public.fraction_stock(
    '00000000-0000-0000-0000-000000001301',
    '00000000-0000-0000-0000-00000000f302',
    2, 500, 0, 9999, 'open'::public.stock_lot_status
  )
$$, 'La administradora fracciona 500 g más y el servidor calcula 3200 g restantes');

RESET role;

SELECT * FROM finish();
ROLLBACK;
