BEGIN;
SELECT plan(22);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000f101', 'offline-stock-employee@test'),
  ('00000000-0000-0000-0000-00000000f102', 'offline-stock-other@test'),
  ('00000000-0000-0000-0000-00000000f103', 'offline-stock-admin@test'),
  ('00000000-0000-0000-0000-00000000f104', 'offline-stock-inactive@test');
UPDATE public.profiles SET role = 'administrator'
WHERE id = '00000000-0000-0000-0000-00000000f103';
UPDATE public.profiles SET active = false
WHERE id = '00000000-0000-0000-0000-00000000f104';

INSERT INTO public.products (id, name, base_unit, price_multiplier)
VALUES ('00000000-0000-0000-0000-00000000f110', 'RF offline stock', 'gram', 2.5);
INSERT INTO public.product_presentations (id, product_id, name, base_quantity, sold_by_weight)
VALUES
  ('00000000-0000-0000-0000-00000000f111', '00000000-0000-0000-0000-00000000f110', 'Granel offline', 1, true),
  ('00000000-0000-0000-0000-00000000f112', '00000000-0000-0000-0000-00000000f110', 'Paquete offline', 10, false);

CREATE FUNCTION pg_temp.envelope(p_local_id uuid, p_user_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'localId', p_local_id,
    'deviceId', '00000000-0000-0000-0000-00000000f120',
    'kind', 'stock_movement',
    'createdAt', now(),
    'payload', p_payload || jsonb_build_object('userId', p_user_id)
  )
$$;
CREATE TEMP TABLE offline_test_origin_lot(id uuid);
CREATE FUNCTION pg_temp.restock_op()
RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.envelope(
    '00000000-0000-0000-0000-00000000f121',
    '00000000-0000-0000-0000-00000000f101',
    jsonb_build_object('action','quick_restock','presentationId','00000000-0000-0000-0000-00000000f111',
      'productId','00000000-0000-0000-0000-00000000f110','quantity',50,'expiryDate',null)
  )
$$;
CREATE FUNCTION pg_temp.adjust_op(p_local_id uuid,p_quantity numeric,p_kind text,p_user_id uuid,p_presentation_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT pg_temp.envelope(p_local_id,p_user_id,jsonb_build_object(
    'action','adjust_stock','lotId',CASE WHEN p_presentation_id='00000000-0000-0000-0000-00000000f111'
      THEN (SELECT id FROM pg_temp.offline_test_origin_lot LIMIT 1)
      ELSE (SELECT id FROM public.employee_stock_lots WHERE presentation_id=p_presentation_id ORDER BY created_at DESC LIMIT 1) END,
    'productId','00000000-0000-0000-0000-00000000f110','movementKind',p_kind,
    'quantity',p_quantity,'reason','Ajuste offline de conteo'
  ))
$$;
CREATE FUNCTION pg_temp.fraction_op()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT pg_temp.envelope(
    '00000000-0000-0000-0000-00000000f140',
    '00000000-0000-0000-0000-00000000f101',
    jsonb_build_object('action','fraction_stock','originLotId',(SELECT id FROM pg_temp.offline_test_origin_lot LIMIT 1),
      'targetPresentationId','00000000-0000-0000-0000-00000000f112','packetsNum',2,
      'gramsNeeded',20,'merma',5,'newOriginQuantity',30,'originLotStatus','closed')
  )
$$;
CREATE FUNCTION pg_temp.open_op(p_user_id uuid)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.envelope(
    '00000000-0000-0000-0000-00000000f150',p_user_id,
    jsonb_build_object('action','open_lot','lotId',
      (SELECT id FROM public.employee_stock_lots WHERE presentation_id='00000000-0000-0000-0000-00000000f112' LIMIT 1))
  )
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;

SELECT is(has_function_privilege('anon','public.apply_offline_operation(jsonb)','EXECUTE'),false,
  'Anon no puede procesar operaciones offline');

-- The administrator seeds a target receipt; all employee changes below are
-- queued and applied through the same idempotent RPC used on reconnection.
SET request.jwt.claim.sub='00000000-0000-0000-0000-00000000f103';
SELECT lives_ok($$INSERT INTO pg_temp.offline_test_origin_lot(id) SELECT public.quick_restock(
  '00000000-0000-0000-0000-00000000f111','00000000-0000-0000-0000-00000000f110',50,current_date)$$,
  'Administrador prepara el lote para el flujo offline');

SET request.jwt.claim.sub='00000000-0000-0000-0000-00000000f101';
SET role authenticated;
SELECT lives_ok($$SELECT public.apply_offline_operation(pg_temp.restock_op())$$,
  'Empleado sincroniza un ingreso guardado localmente');
SELECT lives_ok($$SELECT public.apply_offline_operation(pg_temp.restock_op())$$,
  'Reintentar el mismo ingreso confirma sin duplicarlo');
RESET role;
SELECT is((SELECT count(*)::int FROM public.stock_lots
  WHERE presentation_id='00000000-0000-0000-0000-00000000f111'),2,
  'El reintento deja un solo lote para el ingreso offline');
SELECT is((SELECT count(*)::int FROM public.offline_operations
  WHERE local_id='00000000-0000-0000-0000-00000000f121'),1,
  'El ledger idempotente guarda una sola operación');
SELECT is((SELECT count(*)::int FROM public.stock_movements sm
  JOIN public.stock_lots sl ON sl.id=sm.lot_id
  WHERE sl.presentation_id='00000000-0000-0000-0000-00000000f111'
    AND sm.reason='Ingreso rápido de mercadería (RF-51)'),2,
  'El reintento no duplica el movimiento de ingreso');

SET request.jwt.claim.sub='00000000-0000-0000-0000-00000000f101';
SET role authenticated;
SELECT lives_ok($$SELECT public.apply_offline_operation(pg_temp.adjust_op(
  '00000000-0000-0000-0000-00000000f131',5,'adjustment','00000000-0000-0000-0000-00000000f101','00000000-0000-0000-0000-00000000f111'))$$,
  'Empleado sincroniza un ajuste positivo offline');
SELECT lives_ok($$SELECT public.apply_offline_operation(pg_temp.adjust_op(
  '00000000-0000-0000-0000-00000000f131',5,'adjustment','00000000-0000-0000-0000-00000000f101','00000000-0000-0000-0000-00000000f111'))$$,
  'Reintentar el ajuste no lo aplica dos veces');
RESET role;
SELECT is((SELECT current_quantity FROM public.employee_stock_lots
  WHERE id=(SELECT id FROM pg_temp.offline_test_origin_lot LIMIT 1)),55::numeric,
  'El RPC actualiza atómicamente la cantidad real del lote');
SELECT throws_ok($$SELECT public.apply_offline_operation(pg_temp.envelope(
  '00000000-0000-0000-0000-00000000f132','00000000-0000-0000-0000-00000000f102',
  jsonb_build_object('action','adjust_stock','lotId',(SELECT id FROM pg_temp.offline_test_origin_lot LIMIT 1),
    'productId','00000000-0000-0000-0000-00000000f110','movementKind','adjustment',
    'quantity',5,'reason','Suplantación'))))$$,
  '42501', 'La operación de stock pertenece a otro usuario.',
  'La operación offline no se puede sincronizar con la cuenta de otro empleado');

SET role authenticated;
SELECT lives_ok($$SELECT public.apply_offline_operation(pg_temp.fraction_op())$$,
  'Empleado sincroniza fraccionamiento offline');
SELECT lives_ok($$SELECT public.apply_offline_operation(pg_temp.fraction_op())$$,
  'Reintentar el fraccionamiento no crea otro lote ni movimientos');
RESET role;
SELECT is((SELECT current_quantity FROM public.employee_stock_lots
  WHERE id=(SELECT id FROM pg_temp.offline_test_origin_lot LIMIT 1)),30::numeric,
  'Fraccionamiento offline actualiza el remanente real del lote origen');
SELECT is((SELECT count(*)::int FROM public.stock_lots
  WHERE presentation_id='00000000-0000-0000-0000-00000000f112'),1,
  'Reintentar el fraccionamiento deja un lote destino');
SELECT is((SELECT current_quantity FROM public.employee_stock_lots
  WHERE presentation_id='00000000-0000-0000-0000-00000000f112'),2::numeric,
  'El lote destino recibe las unidades fraccionadas');
SELECT is((SELECT count(*)::int FROM public.stock_movements
  WHERE lot_id=(SELECT id FROM pg_temp.offline_test_origin_lot LIMIT 1)
    AND reason='Merma por cierre de bolsa en fraccionamiento'),1,
  'La merma offline se registra una sola vez');

SET request.jwt.claim.sub='00000000-0000-0000-0000-00000000f101';
SET role authenticated;
SELECT lives_ok($$SELECT public.apply_offline_operation(pg_temp.open_op('00000000-0000-0000-0000-00000000f101'))$$,
  'Empleado sincroniza la apertura de lote offline');
RESET role;
SELECT ok((SELECT opened_at IS NOT NULL FROM public.employee_stock_lots
  WHERE presentation_id='00000000-0000-0000-0000-00000000f112'),
  'La apertura offline persiste opened_at en el lote');

SET request.jwt.claim.sub='00000000-0000-0000-0000-00000000f102';
SET role authenticated;
SELECT lives_ok($$SELECT public.apply_offline_operation(pg_temp.adjust_op(
  '00000000-0000-0000-0000-00000000f160',1,'adjustment','00000000-0000-0000-0000-00000000f102','00000000-0000-0000-0000-00000000f112'))$$,
  'El segundo empleado puede sincronizar sus propios ajustes');
SELECT is((SELECT count(*)::int FROM public.stock_movements
  WHERE user_id='00000000-0000-0000-0000-00000000f101'),0,
  'El segundo empleado no puede leer movimientos del primero');
RESET role;

SET request.jwt.claim.sub='00000000-0000-0000-0000-00000000f104';
SET role authenticated;
SELECT throws_ok($$SELECT public.apply_offline_operation(pg_temp.adjust_op(
  '00000000-0000-0000-0000-00000000f170',1,'adjustment','00000000-0000-0000-0000-00000000f104','00000000-0000-0000-0000-00000000f112'))$$,
  '42501', 'Authentication required',
  'Un perfil inactivo no puede sincronizar cambios de stock');

RESET role;
SELECT * FROM finish();
ROLLBACK;

