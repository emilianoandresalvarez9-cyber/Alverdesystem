BEGIN;
SELECT plan(10);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'test_employee@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'test_admin@example.com');
UPDATE public.profiles SET role = 'administrator'
WHERE id = '00000000-0000-0000-0000-000000000002';

INSERT INTO public.products (id, name, base_unit)
VALUES ('00000000-0000-0000-0000-000000000200', 'Lentejas', 'gram');
INSERT INTO public.product_presentations (id, product_id, name, base_quantity, sold_by_weight)
VALUES
  ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000200', 'Granel', 1, true),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000200', 'Bolsa 2 g', 2, false);

-- RF-51: an employee can receive stock through the RPC.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET role authenticated;
SELECT lives_ok(
  $$SELECT public.quick_restock(
    '00000000-0000-0000-0000-000000000300',
    '00000000-0000-0000-0000-000000000200', 9, current_date)$$,
  'Empleado puede registrar ingreso rápido por RPC'
);

-- Administrator path remains valid.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SET role authenticated;
SELECT lives_ok(
  $$SELECT public.quick_restock(
    '00000000-0000-0000-0000-000000000300',
    '00000000-0000-0000-0000-000000000200', 10, current_date)$$,
  'Administradora puede registrar ingreso rápido'
);

CREATE TEMP TABLE temp_lot AS
SELECT id FROM public.stock_lots
WHERE presentation_id = '00000000-0000-0000-0000-000000000300'
  AND initial_quantity = 10;
SELECT is((SELECT count(*)::int FROM temp_lot), 1, 'Ingreso rápido crea el lote esperado');
SELECT is((SELECT current_quantity FROM public.stock_lots WHERE id = (SELECT id FROM temp_lot)),
  10::numeric, 'El lote comienza con 10 unidades base');

-- RF-57: employees record reasoned decreases; server ignores caller-supplied
-- resulting quantity and derives the update from the locked lot row.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET role authenticated;
SELECT lives_ok(
  $$SELECT public.adjust_stock(
    (SELECT id FROM temp_lot), '00000000-0000-0000-0000-000000000200',
    'waste', -2, 'Rotura de envase', 0, true)$$,
  'Empleado registra merma con motivo'
);

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SET role authenticated;
SELECT is((SELECT current_quantity FROM public.stock_lots WHERE id = (SELECT id FROM temp_lot)),
  8::numeric, 'La merma descuenta la cantidad calculada por la base');
SELECT lives_ok(
  $$SELECT public.adjust_stock(
    (SELECT id FROM temp_lot), '00000000-0000-0000-0000-000000000200',
    'adjustment', -1, 'Conteo', 7, false)$$,
  'Administradora registra ajuste de stock'
);
SELECT is((SELECT current_quantity FROM public.stock_lots WHERE id = (SELECT id FROM temp_lot)),
  7::numeric, 'El ajuste administrativo descuenta una unidad');

-- RF-14: fractioning only consumes a weight-sold source and creates fixed packs.
SELECT lives_ok(
  $$SELECT public.fraction_stock(
    (SELECT id FROM temp_lot), '00000000-0000-0000-0000-000000000301',
    2, 4, 0, 3, 'open'::public.stock_lot_status)$$,
  'Administradora fracciona el lote de granel'
);
SELECT is((SELECT current_quantity FROM public.stock_lots
  WHERE presentation_id = '00000000-0000-0000-0000-000000000301'),
  2::numeric, 'El lote destino recibe dos paquetes');

RESET role;
SELECT * FROM finish();
ROLLBACK;
