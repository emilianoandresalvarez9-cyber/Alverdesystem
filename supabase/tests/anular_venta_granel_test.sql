-- Tests de 20261022190000_anular_venta_granel_bolsa_abierta.sql (A-05, RF-12, RF-37).
BEGIN;
SELECT plan(8);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000a501', 'admin-a05@test'),
  ('00000000-0000-0000-0000-00000000a502', 'emp1-a05@test'),
  ('00000000-0000-0000-0000-00000000a503', 'emp2-a05@test');

UPDATE public.profiles SET role = 'administrator' WHERE id = '00000000-0000-0000-0000-00000000a501';

INSERT INTO public.branches (id, name) VALUES
  ('00000000-0000-0000-0000-00000000b501', 'Sucursal A05');

UPDATE public.profiles SET branch_id = '00000000-0000-0000-0000-00000000b501'
  WHERE id IN ('00000000-0000-0000-0000-00000000a501', '00000000-0000-0000-0000-00000000a502', '00000000-0000-0000-0000-00000000a503');

INSERT INTO public.registers (id, branch_id, name) VALUES
  ('00000000-0000-0000-0000-00000000c501', '00000000-0000-0000-0000-00000000b501', 'Caja A05');

INSERT INTO public.cash_shifts (id, register_id, user_id) VALUES
  ('00000000-0000-0000-0000-00000000d501', '00000000-0000-0000-0000-00000000c501', '00000000-0000-0000-0000-00000000a502');

INSERT INTO public.products (id, name, base_unit) VALUES
  ('00000000-0000-0000-0000-00000000e501', 'Avena A05', 'gram');

INSERT INTO public.product_presentations (id, product_id, name, base_quantity, sale_price, sold_by_weight) VALUES
  ('00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000e501', 'Balanza', 1, 5, true);

-- Lote 1 abierto con 500 g; Lote 2 cerrado (sin abrir) con 5000 g.
INSERT INTO public.stock_lots (
  id, presentation_id, initial_quantity, current_quantity, purchase_cost, opened_at, status, branch_id
) VALUES
  ('00000000-0000-0000-0000-000000001501', '00000000-0000-0000-0000-00000000f501', 5000, 500, 2, now() - interval '2 days', 'open', '00000000-0000-0000-0000-00000000b501'),
  ('00000000-0000-0000-0000-000000001502', '00000000-0000-0000-0000-00000000f501', 5000, 5000, 2, null, 'open', '00000000-0000-0000-0000-00000000b501');

-- 1. anon no tiene permiso sobre sale_void_return_stock
SELECT is(
  has_function_privilege('anon', 'public.sale_void_return_stock()', 'EXECUTE'),
  false,
  'anon no puede ejecutar sale_void_return_stock'
);

-- 2. La empleada 1 vende los últimos 500 g del Lote 1 (queda en 0 g) y luego abre el Lote 2.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a502';
SET role authenticated;

SELECT lives_ok($$
  SELECT public.process_offline_sale(jsonb_build_object(
    'localId', '00000000-0000-0000-0000-000000009501',
    'deviceId', '00000000-0000-0000-0000-000000008501',
    'kind', 'sale',
    'payload', jsonb_build_object(
      'paymentMethod', 'cash',
      'shiftId', '00000000-0000-0000-0000-00000000d501',
      'items', jsonb_build_array(
        jsonb_build_object('presentationId', '00000000-0000-0000-0000-00000000f501', 'quantity', 500, 'unitPrice', 5)
      )
    )
  ))
$$, 'La venta consume los últimos 500 g de la primera bolsa abierta');

SELECT lives_ok($$
  SELECT public.open_stock_lot('00000000-0000-0000-0000-000000001502')
$$, 'Con la primera bolsa en 0 g, la empleada abre la segunda bolsa de granel');

-- 3. Ni la empleada que vendió ni otro empleado pueden anular la venta
UPDATE public.sales SET status = 'voided' WHERE local_id = '00000000-0000-0000-0000-000000009501';
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a503';
UPDATE public.sales SET status = 'voided' WHERE local_id = '00000000-0000-0000-0000-000000009501';
RESET role;

SELECT is(
  (SELECT status::text FROM public.sales WHERE local_id = '00000000-0000-0000-0000-000000009501'),
  'closed',
  'Ningún empleado puede anular la venta'
);

-- 4. La administradora anula la venta: no choca con P0001 y devuelve los 500 g a la bolsa abierta vigente (Lote 2)
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a501';
SET role authenticated;

SELECT lives_ok($$
  UPDATE public.sales SET status = 'voided' WHERE local_id = '00000000-0000-0000-0000-000000009501'
$$, 'A-05: la administradora anula la venta de granel sin chocar con la regla de una sola bolsa abierta');

RESET role;

SELECT is(
  (SELECT current_quantity FROM public.stock_lots WHERE id = '00000000-0000-0000-0000-000000001502'),
  5500.000::numeric,
  'Los 500 g anulados se suman a la bolsa abierta vigente (5000 + 500 = 5500)'
);

SELECT is(
  (SELECT status::text FROM public.stock_lots WHERE id = '00000000-0000-0000-0000-000000001501'),
  'closed',
  'La bolsa anterior que había quedado vacía pasa a estado closed'
);

SELECT is(
  (SELECT sum(quantity) FROM public.stock_movements WHERE reason LIKE '%00000000-0000-0000-0000-000000009501%'),
  0.000::numeric,
  'Los movimientos de venta y anulación suman cero'
);

SELECT * FROM finish();
ROLLBACK;
