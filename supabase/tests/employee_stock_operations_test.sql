BEGIN;
SELECT plan(30);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000e101', 'stock-employee@test'),
  ('00000000-0000-0000-0000-00000000e102', 'stock-other-employee@test'),
  ('00000000-0000-0000-0000-00000000e103', 'stock-admin@test'),
  ('00000000-0000-0000-0000-00000000e104', 'stock-inactive@test');
UPDATE public.profiles SET role = 'administrator'
WHERE id = '00000000-0000-0000-0000-00000000e103';
UPDATE public.profiles SET active = false
WHERE id = '00000000-0000-0000-0000-00000000e104';

INSERT INTO public.products (id, name, base_unit, price_multiplier)
VALUES ('00000000-0000-0000-0000-00000000e110', 'RF stock employee', 'gram', 2.5);
INSERT INTO public.product_presentations (id, product_id, name, base_quantity, sold_by_weight)
VALUES
  ('00000000-0000-0000-0000-00000000e111', '00000000-0000-0000-0000-00000000e110', 'Granel empleado', 1, true),
  ('00000000-0000-0000-0000-00000000e112', '00000000-0000-0000-0000-00000000e110', 'Paquete empleado', 10, false),
  ('00000000-0000-0000-0000-00000000e113', '00000000-0000-0000-0000-00000000e110', 'Paquete total empleado', 103, false);

-- Anonymous callers cannot read the staff projections or call stock RPCs.
SELECT is(has_table_privilege('anon', 'public.employee_stock_lots', 'SELECT'), false,
  'Anon no puede consultar la vista de lotes operativos');
SELECT is(has_function_privilege('anon',
  'public.quick_restock(uuid,uuid,numeric,date,numeric)', 'EXECUTE'), false,
  'Anon no puede registrar ingresos');
SELECT is(has_function_privilege('anon', 'public.open_stock_lot(uuid)', 'EXECUTE'), false,
  'Anon no puede abrir lotes');

-- Empleado can receive stock, but cannot inject a client-supplied cost.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e101';
SET role authenticated;
SELECT lives_ok($$SELECT public.quick_restock(
  '00000000-0000-0000-0000-00000000e111',
  '00000000-0000-0000-0000-00000000e110', 100, current_date)$$,
  'Empleado registra un lote de granel sin conocer ni enviar costos');
SELECT throws_ok($$SELECT public.quick_restock(
  '00000000-0000-0000-0000-00000000e111',
  '00000000-0000-0000-0000-00000000e110', 1, current_date, 0.01)$$,
  '42501', 'Solo la administradora puede indicar un costo manual.',
  'Empleado no puede alterar el costo calculado por la base');
SELECT is((SELECT count(*)::int FROM public.employee_stock_lots
  WHERE presentation_id = '00000000-0000-0000-0000-00000000e111'), 1,
  'Empleado ve el lote recién recibido en la proyección segura');
SELECT ok((SELECT bool_and(NOT (to_jsonb(lot) ? 'purchase_cost'))
  FROM public.employee_stock_lots lot),
  'La proyección de lotes no incluye purchase_cost');
SELECT ok((SELECT bool_and(to_jsonb(lot) ? 'created_at')
  FROM public.employee_stock_lots lot),
  'La proyección incluye created_at para ordenar los lotes');
SELECT ok(NOT (to_jsonb(catalog_row) ? 'price_multiplier')
  FROM public.employee_catalog catalog_row
  WHERE presentation_id = '00000000-0000-0000-0000-00000000e111'),
  'El catálogo operativo no incluye price_multiplier');
SELECT is((SELECT count(*)::int FROM public.stock_lots), 0,
  'La política RLS impide que Empleado lea la tabla base de lotes');

-- RF-57: both adding and removing stock are reasoned, atomic movements.
SELECT lives_ok($$SELECT public.adjust_stock(
  (SELECT id FROM public.employee_stock_lots
   WHERE presentation_id = '00000000-0000-0000-0000-00000000e111'),
  '00000000-0000-0000-0000-00000000e110',
  'adjustment', 5, 'Conteo físico, agregar cinco', 0, true)$$,
  'Empleado puede agregar stock con motivo');
SELECT is((SELECT current_quantity FROM public.employee_stock_lots
  WHERE presentation_id = '00000000-0000-0000-0000-00000000e111'), 105::numeric,
  'Cantidad positiva deriva el nuevo saldo bajo bloqueo de fila aunque supere el ingreso original');
SELECT is((SELECT status::text FROM public.employee_stock_lots
  WHERE presentation_id = '00000000-0000-0000-0000-00000000e111'), 'open',
  'El indicador de cierre enviado por el cliente no cierra un lote con saldo');
SELECT lives_ok($$SELECT public.adjust_stock(
  (SELECT id FROM public.employee_stock_lots
   WHERE presentation_id = '00000000-0000-0000-0000-00000000e111'),
  '00000000-0000-0000-0000-00000000e110',
  'waste', -2, 'Rotura', 0, true)$$,
  'Empleado puede descontar merma con motivo');
SELECT is((SELECT current_quantity FROM public.employee_stock_lots
  WHERE presentation_id = '00000000-0000-0000-0000-00000000e111'), 103::numeric,
  'Merma descuenta del saldo del lote');
SELECT throws_ok($$SELECT public.adjust_stock(
  (SELECT id FROM public.employee_stock_lots
   WHERE presentation_id = '00000000-0000-0000-0000-00000000e111'),
  '00000000-0000-0000-0000-00000000e110',
  'adjustment', -999, 'Intento excedido', 0, true)$$,
  '22023', 'La cantidad a quitar supera el stock disponible.',
  'La base rechaza ajustes que harían el stock negativo');

-- RF-14/16: recompute fractioning from locked server state and preserve actual
-- remnant, recording the difference as waste.
SELECT throws_ok($$SELECT public.fraction_stock(
  (SELECT id FROM public.employee_stock_lots
   WHERE presentation_id = '00000000-0000-0000-0000-00000000e111'),
  '00000000-0000-0000-0000-00000000e112', 2, 19, 0, 84,
  'open'::public.stock_lot_status)$$,
  '22023', 'La cantidad a descontar no coincide con el peso de las presentaciones generadas.',
  'La base rechaza un total de fraccionamiento manipulado');
SELECT throws_ok($$SELECT public.fraction_stock(
  (SELECT id FROM public.employee_stock_lots
   WHERE presentation_id = '00000000-0000-0000-0000-00000000e111'),
  '00000000-0000-0000-0000-00000000e113', 1, 103, 0, 0,
  'open'::public.stock_lot_status)$$,
  '22023', 'Si no queda remanente, debe marcar la bolsa como terminada.',
  'La base impide dejar abierto un lote sin stock');
SELECT lives_ok($$SELECT public.fraction_stock(
  (SELECT id FROM public.employee_stock_lots
   WHERE presentation_id = '00000000-0000-0000-0000-00000000e111'),
  '00000000-0000-0000-0000-00000000e112', 2, 20, 43, 40,
  'closed'::public.stock_lot_status)$$,
  'Empleado puede fraccionar granel en presentaciones');
SELECT is((SELECT current_quantity FROM public.employee_stock_lots
  WHERE presentation_id = '00000000-0000-0000-0000-00000000e111'), 40::numeric,
  'El fraccionamiento conserva el remanente real informado');
SELECT is((SELECT status::text FROM public.employee_stock_lots
  WHERE presentation_id = '00000000-0000-0000-0000-00000000e111'), 'closed',
  'La bolsa marcada como terminada queda cerrada');
SELECT is((SELECT count(*)::int FROM public.stock_movements
  WHERE lot_id = (SELECT id FROM public.employee_stock_lots
    WHERE presentation_id = '00000000-0000-0000-0000-00000000e111')
    AND kind = 'waste'), 1,
  'La diferencia entre remanente teórico y real queda registrada como merma');
SELECT is((SELECT current_quantity FROM public.employee_stock_lots
  WHERE presentation_id = '00000000-0000-0000-0000-00000000e112'), 2::numeric,
  'El fraccionamiento crea la cantidad de paquetes indicada');
SELECT lives_ok($$SELECT public.open_stock_lot(
  (SELECT id FROM public.employee_stock_lots
   WHERE presentation_id = '00000000-0000-0000-0000-00000000e112'))$$,
  'Empleado puede abrir un lote de presentación fraccionada');

-- Another employee can carry out daily operations but cannot see the first
-- employee's append-only movement rows.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e102';
SET role authenticated;
SELECT lives_ok($$SELECT public.quick_restock(
  '00000000-0000-0000-0000-00000000e112',
  '00000000-0000-0000-0000-00000000e110', 2, current_date)$$,
  'Otro empleado también puede registrar ingreso rápido');
SELECT lives_ok($$SELECT public.adjust_stock(
  (SELECT id FROM public.employee_stock_lots
   WHERE presentation_id = '00000000-0000-0000-0000-00000000e112'
     AND current_quantity = 2 LIMIT 1),
  '00000000-0000-0000-0000-00000000e110',
  'adjustment', -1, 'Conteo de segundo turno', 999, true)$$,
  'Otro empleado puede ajustar stock con motivo');
SELECT is((SELECT count(*)::int FROM public.stock_movements
  WHERE user_id = '00000000-0000-0000-0000-00000000e101'), 0,
  'Otro empleado no puede leer movimientos privados del primer empleado');

-- A logged-in user whose profile is inactive cannot see the security-definer
-- projection or execute stock operations.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000e104';
SET role authenticated;
SELECT is((SELECT count(*)::int FROM public.employee_stock_lots), 0,
  'Un perfil inactivo no consulta la vista de lotes');
SELECT throws_ok($$SELECT public.quick_restock(
  '00000000-0000-0000-0000-00000000e111',
  '00000000-0000-0000-0000-00000000e110', 1, current_date)$$,
  '42501', 'Authentication required',
  'Un perfil inactivo no puede registrar ingreso');
SELECT throws_ok($$SELECT public.open_stock_lot(
  (SELECT id FROM public.employee_stock_lots LIMIT 1))$$,
  '42501', 'Authentication required',
  'Un perfil inactivo no puede abrir lotes');

RESET role;
SELECT * FROM finish();
ROLLBACK;
