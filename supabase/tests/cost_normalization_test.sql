BEGIN;
SELECT plan(14);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000f261', 'cost-admin@test'),
  ('00000000-0000-0000-0000-00000000f262', 'cost-employee@test');
UPDATE public.profiles SET role = 'administrator' WHERE id = '00000000-0000-0000-0000-00000000f261';

INSERT INTO public.products (id, name, base_unit)
VALUES ('00000000-0000-0000-0000-00000000f263', 'RF cost lentejas', 'gram');
INSERT INTO public.product_presentations (id, product_id, name, base_quantity, sale_price, sold_by_weight)
VALUES
  ('00000000-0000-0000-0000-00000000f264', '00000000-0000-0000-0000-00000000f263', 'Granel', 1, 3.2, true),
  ('00000000-0000-0000-0000-00000000f265', '00000000-0000-0000-0000-00000000f263', 'Bolsa 150 g', 150, 500, false);
INSERT INTO public.suppliers (id, name)
VALUES ('00000000-0000-0000-0000-00000000f266', 'RF cost proveedor');

SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f261';
SET role authenticated;
SELECT lives_ok($$SELECT public.save_supplier_product_cost(
  '00000000-0000-0000-0000-00000000f263',
  '00000000-0000-0000-0000-00000000f266',
  40000, 25000, 'L-25', true)$$,
  'Admin guarda precio total y contenido del envase');

CREATE TEMP TABLE bulk_lot AS
SELECT public.quick_restock(
  '00000000-0000-0000-0000-00000000f264',
  '00000000-0000-0000-0000-00000000f263',
  25000, current_date
) AS id;
SELECT is((SELECT purchase_cost FROM public.stock_lots WHERE id = (SELECT id FROM bulk_lot)),
  1.60::numeric, 'Ingreso rápido convierte costo del envase a costo por gramo');
SELECT is((SELECT supplier_id FROM public.stock_lots WHERE id = (SELECT id FROM bulk_lot)),
  '00000000-0000-0000-0000-00000000f266'::uuid, 'Ingreso rápido conserva el proveedor principal del lote');
SELECT is((SELECT initial_quantity FROM public.stock_lots WHERE id = (SELECT id FROM bulk_lot)),
  25000::numeric, 'Ingreso rápido conserva la cantidad en gramos');

SELECT lives_ok($$SELECT public.fraction_stock(
  (SELECT id FROM bulk_lot),
  '00000000-0000-0000-0000-00000000f265',
  10, 1500, 0, 23500, 'open'::public.stock_lot_status)$$,
  'Admin fracciona una parte del lote de granel');
CREATE TEMP TABLE bag_lot AS
SELECT id FROM public.stock_lots WHERE presentation_id = '00000000-0000-0000-0000-00000000f265';
SELECT is((SELECT purchase_cost FROM public.stock_lots WHERE id = (SELECT id FROM bag_lot)),
  240.00::numeric, 'Fraccionamiento escala costo de $1.60/g a $240 por bolsa de 150 g');
SELECT is((SELECT supplier_id FROM public.stock_lots WHERE id = (SELECT id FROM bag_lot)),
  '00000000-0000-0000-0000-00000000f266'::uuid, 'Fraccionamiento conserva proveedor de origen');
SELECT is((SELECT current_quantity FROM public.stock_lots WHERE id = (SELECT id FROM bulk_lot)),
  23500::numeric, 'Fraccionamiento conserva la cantidad restante del lote origen');

CREATE TEMP TABLE fixed_lot AS
SELECT public.quick_restock(
  '00000000-0000-0000-0000-00000000f265',
  '00000000-0000-0000-0000-00000000f263',
  2, current_date
) AS id;
SELECT is((SELECT purchase_cost FROM public.stock_lots WHERE id = (SELECT id FROM fixed_lot)),
  240.00::numeric, 'Ingreso rápido calcula costo por presentación fija de 150 g');
SELECT is((SELECT supplier_id FROM public.stock_lots WHERE id = (SELECT id FROM fixed_lot)),
  '00000000-0000-0000-0000-00000000f266'::uuid, 'Ingreso rápido enlaza proveedor en presentación fija');

RESET role;
SELECT is(has_function_privilege('anon',
  'public.quick_restock(uuid,uuid,numeric,date,numeric)', 'EXECUTE'), false,
  'Anon no puede ejecutar ingreso rápido');

SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f262';
SET role authenticated;
SELECT throws_ok($$SELECT public.quick_restock(
  '00000000-0000-0000-0000-00000000f264',
  '00000000-0000-0000-0000-00000000f263',
  1, current_date)$$,
  '42501', 'Solo la administradora puede ingresar stock.',
  'Empleado no puede ejecutar ingreso rápido ni consultar el costo almacenado');
SELECT is((SELECT count(*)::int FROM public.employee_stock_lots), 3,
  'Empleado ve los lotes operativos sin acceso a la tabla base de costos');
SELECT ok((SELECT bool_and(NOT (to_jsonb(lot) ? 'purchase_cost'))
  FROM public.employee_stock_lots lot),
  'La vista operativa que recibe Empleado no contiene el campo de costo');

RESET role;
SELECT * FROM finish();
ROLLBACK;
