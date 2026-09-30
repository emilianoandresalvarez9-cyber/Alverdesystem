-- Expose only operational lot metadata to signed-in staff. Cost remains in
-- stock_lots and is never projected into this view.
CREATE OR REPLACE VIEW public.employee_stock_lots
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  sl.id,
  sl.presentation_id,
  sl.supplier_id,
  sl.initial_quantity,
  sl.current_quantity,
  sl.received_at,
  sl.manufacturer_expiry_date,
  sl.opened_at,
  sl.portioned_at,
  sl.status,
  public.effective_expiry_date(
    sl.manufacturer_expiry_date,
    sl.opened_at,
    p.open_shelf_life_days
  ) AS effective_expiry_date,
  p.id AS product_id,
  p.name AS product_name,
  p.base_unit,
  p.open_shelf_life_days,
  pr.name AS presentation_name,
  pr.base_quantity,
  pr.sold_by_weight,
  s.name AS supplier_name,
  sl.created_at
FROM public.stock_lots sl
JOIN public.product_presentations pr ON pr.id = sl.presentation_id
JOIN public.products p ON p.id = pr.product_id
LEFT JOIN public.suppliers s ON s.id = sl.supplier_id
WHERE public.current_app_role() IS NOT NULL;

REVOKE ALL ON public.employee_stock_lots FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.employee_stock_lots TO authenticated;
COMMENT ON VIEW public.employee_stock_lots IS
  'Restricted stock-operation projection for signed-in staff. Includes lot identity and operational product/presentation metadata; never includes purchase_cost.';

-- Initial quantity remains a receipt snapshot. A documented positive stock
-- adjustment may legitimately make the current quantity exceed that snapshot.
ALTER TABLE public.stock_lots
  DROP CONSTRAINT IF EXISTS stock_lots_check;
COMMENT ON COLUMN public.stock_lots.initial_quantity IS
  'Quantity recorded when the lot was first received; current_quantity may exceed it after a reasoned positive stock adjustment.';

-- Employees and administrators can open lots. The trigger on stock_lots still
-- enforces the one-open-bulk-lot rule under a row lock.
CREATE OR REPLACE FUNCTION public.open_stock_lot(p_lot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role := public.current_app_role();
  v_status public.stock_lot_status;
  v_opened_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_role IS NULL OR v_role NOT IN ('administrator', 'employee') THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT sl.status, sl.opened_at
    INTO v_status, v_opened_at
  FROM public.stock_lots sl
  WHERE sl.id = p_lot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote no encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'No se puede abrir un lote cerrado.' USING ERRCODE = '22023';
  END IF;
  IF v_opened_at IS NULL THEN
    UPDATE public.stock_lots SET opened_at = now() WHERE id = p_lot_id;
  END IF;
END;
$$;

-- Keep the old RPC signature for deployed clients, but derive stock changes
-- from the locked row. Caller-provided resulting quantity/close flag are not
-- trusted. Adjustment can add or remove stock; waste and discard only remove.
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_lot_id uuid,
  p_product_id uuid,
  p_kind public.stock_movement_kind,
  p_quantity numeric,
  p_reason text,
  p_new_lot_quantity numeric,
  p_should_close_lot boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.app_role := public.current_app_role();
  v_product_id uuid;
  v_current_quantity numeric(14,3);
  v_status public.stock_lot_status;
  v_new_quantity numeric(14,3);
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL OR v_role NOT IN ('administrator', 'employee') THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('waste', 'discard', 'adjustment') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido para un ajuste.' USING ERRCODE = '22023';
  END IF;
  IF p_quantity IS NULL OR p_quantity = 0 OR p_quantity <> round(p_quantity, 3) THEN
    RAISE EXCEPTION 'La cantidad debe ser distinta de cero y tener hasta tres decimales.' USING ERRCODE = '22023';
  END IF;
  IF p_kind IN ('waste', 'discard') AND p_quantity > 0 THEN
    RAISE EXCEPTION 'Merma y descarte solo pueden quitar stock.' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) = 0 OR char_length(trim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'El motivo es obligatorio y no puede superar 500 caracteres.' USING ERRCODE = '22023';
  END IF;

  SELECT pr.product_id, sl.current_quantity, sl.status
    INTO v_product_id, v_current_quantity, v_status
  FROM public.stock_lots sl
  JOIN public.product_presentations pr ON pr.id = sl.presentation_id
  WHERE sl.id = p_lot_id
  FOR UPDATE OF sl;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote no encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF p_product_id IS DISTINCT FROM v_product_id THEN
    RAISE EXCEPTION 'El producto no corresponde al lote indicado.' USING ERRCODE = '22023';
  END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'No se puede ajustar un lote cerrado.' USING ERRCODE = '22023';
  END IF;

  v_new_quantity := v_current_quantity + p_quantity;
  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'La cantidad a quitar supera el stock disponible.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.stock_movements (
    local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
  ) VALUES (
    gen_random_uuid(), p_kind, v_product_id, p_lot_id, p_quantity,
    trim(p_reason), v_user_id, now()
  );

  UPDATE public.stock_lots
  SET current_quantity = v_new_quantity,
      status = CASE WHEN v_new_quantity = 0 THEN 'closed'::public.stock_lot_status ELSE 'open'::public.stock_lot_status END
  WHERE id = p_lot_id;
END;
$$;

-- Employees may receive stock using the derived supplier cost. Only an
-- administrator may provide a manual cost override.
CREATE OR REPLACE FUNCTION public.quick_restock(
  p_presentation_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_expiry_date date,
  p_purchase_cost numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.app_role := public.current_app_role();
  v_product_id uuid;
  v_base_quantity numeric;
  v_sold_by_weight boolean;
  v_supplier_id uuid;
  v_cost_per_base_unit numeric;
  v_lot_unit_cost numeric;
  v_lot_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL OR v_role NOT IN ('administrator', 'employee') THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero.' USING ERRCODE = '22023';
  END IF;
  IF p_purchase_cost IS NOT NULL AND p_purchase_cost < 0 THEN
    RAISE EXCEPTION 'El costo no puede ser negativo.' USING ERRCODE = '22023';
  END IF;
  IF p_purchase_cost IS NOT NULL AND v_role <> 'administrator' THEN
    RAISE EXCEPTION 'Solo la administradora puede indicar un costo manual.' USING ERRCODE = '42501';
  END IF;

  SELECT pr.product_id, pr.base_quantity, pr.sold_by_weight
    INTO v_product_id, v_base_quantity, v_sold_by_weight
  FROM public.product_presentations pr
  JOIN public.products p ON p.id = pr.product_id
  WHERE pr.id = p_presentation_id AND pr.active AND p.active
  FOR SHARE OF pr, p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto o presentación inexistente o inactivo.' USING ERRCODE = 'P0002';
  END IF;
  IF p_product_id IS DISTINCT FROM v_product_id THEN
    RAISE EXCEPTION 'La presentación no pertenece al producto indicado.' USING ERRCODE = '22023';
  END IF;

  SELECT sp.supplier_id,
         CASE WHEN sp.purchase_quantity > 0 THEN sp.cost / sp.purchase_quantity END
    INTO v_supplier_id, v_cost_per_base_unit
  FROM public.supplier_products sp
  JOIN public.suppliers s ON s.id = sp.supplier_id AND s.active
  WHERE sp.product_id = v_product_id AND sp.is_primary
  ORDER BY sp.last_purchase_at DESC NULLS LAST, sp.supplier_id
  LIMIT 1
  FOR SHARE OF sp;

  IF p_purchase_cost IS NOT NULL THEN
    v_lot_unit_cost := p_purchase_cost;
  ELSIF v_cost_per_base_unit IS NOT NULL THEN
    v_lot_unit_cost := round(
      v_cost_per_base_unit * CASE WHEN v_sold_by_weight THEN 1 ELSE v_base_quantity END,
      2
    );
  ELSE
    v_lot_unit_cost := 0;
  END IF;

  INSERT INTO public.stock_lots (
    presentation_id, supplier_id, initial_quantity, current_quantity,
    purchase_cost, status, manufacturer_expiry_date, received_at
  ) VALUES (
    p_presentation_id, v_supplier_id, p_quantity, p_quantity,
    v_lot_unit_cost, 'open', p_expiry_date, now()
  ) RETURNING id INTO v_lot_id;

  INSERT INTO public.stock_movements (
    local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
  ) VALUES (
    gen_random_uuid(), 'receipt', v_product_id, v_lot_id, p_quantity,
    'Ingreso rápido de mercadería (RF-51)', v_user_id, now()
  );

  RETURN v_lot_id;
END;
$$;

-- Fractioning is recalculated and validated against locked server-side lots;
-- presentation ids and user-submitted totals alone cannot create stock.
CREATE OR REPLACE FUNCTION public.fraction_stock(
  p_origin_lot_id uuid,
  p_target_presentation_id uuid,
  p_packets_num numeric,
  p_grams_needed numeric,
  p_merma numeric,
  p_new_origin_quantity numeric,
  p_origin_lot_status public.stock_lot_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.app_role := public.current_app_role();
  v_origin_product_id uuid;
  v_origin_supplier_id uuid;
  v_origin_cost numeric;
  v_origin_base_quantity numeric;
  v_origin_sold_by_weight boolean;
  v_origin_received_at timestamptz;
  v_origin_expiry date;
  v_origin_opened_at timestamptz;
  v_origin_quantity numeric(14,3);
  v_origin_status public.stock_lot_status;
  v_target_product_id uuid;
  v_target_base_quantity numeric;
  v_target_sold_by_weight boolean;
  v_target_cost numeric;
  v_target_lot_id uuid;
  v_grams_needed numeric(14,3);
  v_theoretical_remaining numeric(14,3);
  v_real_remaining numeric(14,3);
  v_merma numeric(14,3);
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL OR v_role NOT IN ('administrator', 'employee') THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_packets_num IS NULL OR p_packets_num <= 0 OR p_packets_num <> trunc(p_packets_num) THEN
    RAISE EXCEPTION 'La cantidad de paquetes debe ser un entero mayor que cero.' USING ERRCODE = '22023';
  END IF;
  IF p_origin_lot_status IS NULL THEN
    RAISE EXCEPTION 'Debe indicar si la bolsa de origen queda abierta o terminada.' USING ERRCODE = '22023';
  END IF;

  SELECT pp.product_id, sl.supplier_id, sl.purchase_cost, pp.base_quantity,
         pp.sold_by_weight, sl.received_at, sl.manufacturer_expiry_date,
         coalesce(sl.opened_at, now()), sl.current_quantity, sl.status
    INTO v_origin_product_id, v_origin_supplier_id, v_origin_cost,
         v_origin_base_quantity, v_origin_sold_by_weight, v_origin_received_at,
         v_origin_expiry, v_origin_opened_at, v_origin_quantity, v_origin_status
  FROM public.stock_lots sl
  JOIN public.product_presentations pp ON pp.id = sl.presentation_id
  WHERE sl.id = p_origin_lot_id
  FOR UPDATE OF sl;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote origen no encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_origin_status <> 'open' OR v_origin_quantity <= 0 OR NOT v_origin_sold_by_weight THEN
    RAISE EXCEPTION 'El lote de origen debe ser un lote de granel abierto con stock disponible.' USING ERRCODE = '22023';
  END IF;

  SELECT pp.product_id, pp.base_quantity, pp.sold_by_weight
    INTO v_target_product_id, v_target_base_quantity, v_target_sold_by_weight
  FROM public.product_presentations pp
  JOIN public.products p ON p.id = pp.product_id
  WHERE pp.id = p_target_presentation_id AND pp.active AND p.active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presentación destino inexistente o inactiva.' USING ERRCODE = 'P0002';
  END IF;
  IF v_target_product_id IS DISTINCT FROM v_origin_product_id THEN
    RAISE EXCEPTION 'El destino debe ser otra presentación del mismo producto.' USING ERRCODE = '22023';
  END IF;
  IF v_target_sold_by_weight THEN
    RAISE EXCEPTION 'La presentación destino debe venderse por unidad.' USING ERRCODE = '22023';
  END IF;

  v_grams_needed := round(p_packets_num * v_target_base_quantity, 3);
  IF p_grams_needed IS DISTINCT FROM v_grams_needed THEN
    RAISE EXCEPTION 'La cantidad a descontar no coincide con el peso de las presentaciones generadas.' USING ERRCODE = '22023';
  END IF;
  v_theoretical_remaining := round(v_origin_quantity - v_grams_needed, 3);
  IF v_theoretical_remaining < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente en el lote de origen.' USING ERRCODE = '22023';
  END IF;
  IF p_origin_lot_status = 'open' AND v_theoretical_remaining = 0 THEN
    RAISE EXCEPTION 'Si no queda remanente, debe marcar la bolsa como terminada.' USING ERRCODE = '22023';
  END IF;

  IF p_origin_lot_status = 'open' THEN
    v_real_remaining := v_theoretical_remaining;
    v_merma := 0;
  ELSE
    v_real_remaining := p_new_origin_quantity;
    IF v_real_remaining IS NULL OR v_real_remaining < 0 OR v_real_remaining > v_theoretical_remaining THEN
      RAISE EXCEPTION 'El remanente real debe estar entre cero y el remanente teórico.' USING ERRCODE = '22023';
    END IF;
    v_merma := round(v_theoretical_remaining - v_real_remaining, 3);
  END IF;

  IF p_new_origin_quantity IS DISTINCT FROM v_real_remaining OR p_merma IS DISTINCT FROM v_merma THEN
    RAISE EXCEPTION 'El remanente o la merma no coinciden con los valores calculados.' USING ERRCODE = '22023';
  END IF;

  v_target_cost := round(
    (v_origin_cost / CASE WHEN v_origin_sold_by_weight THEN 1 ELSE v_origin_base_quantity END)
    * CASE WHEN v_target_sold_by_weight THEN 1 ELSE v_target_base_quantity END,
    2
  );

  INSERT INTO public.stock_movements (
    local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
  ) VALUES (
    gen_random_uuid(), 'portioning', v_origin_product_id, p_origin_lot_id,
    -v_grams_needed, 'Fraccionamiento: ' || p_packets_num || ' unidades', v_user_id, now()
  );

  IF v_merma > 0 THEN
    INSERT INTO public.stock_movements (
      local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
    ) VALUES (
      gen_random_uuid(), 'waste', v_origin_product_id, p_origin_lot_id, -v_merma,
      'Merma por cierre de bolsa en fraccionamiento', v_user_id, now()
    );
  END IF;

  INSERT INTO public.stock_lots (
    presentation_id, supplier_id, initial_quantity, current_quantity, purchase_cost,
    received_at, manufacturer_expiry_date, opened_at, portioned_at, status
  ) VALUES (
    p_target_presentation_id, v_origin_supplier_id, p_packets_num, p_packets_num,
    v_target_cost, v_origin_received_at, v_origin_expiry, now(), now(), 'open'
  ) RETURNING id INTO v_target_lot_id;

  INSERT INTO public.stock_movements (
    local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
  ) VALUES (
    gen_random_uuid(), 'portioning', v_origin_product_id, v_target_lot_id, p_packets_num,
    'Alta por fraccionamiento desde lote origen', v_user_id, now()
  );

  UPDATE public.stock_lots
  SET current_quantity = v_real_remaining,
      status = p_origin_lot_status,
      opened_at = v_origin_opened_at
  WHERE id = p_origin_lot_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.open_stock_lot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_stock_lot(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(uuid, uuid, public.stock_movement_kind, numeric, text, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, uuid, public.stock_movement_kind, numeric, text, numeric, boolean) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.quick_restock(uuid, uuid, numeric, date, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_restock(uuid, uuid, numeric, date, numeric) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fraction_stock(uuid, uuid, numeric, numeric, numeric, numeric, public.stock_lot_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fraction_stock(uuid, uuid, numeric, numeric, numeric, numeric, public.stock_lot_status) TO authenticated, service_role;

COMMENT ON FUNCTION public.adjust_stock(uuid, uuid, public.stock_movement_kind, numeric, text, numeric, boolean) IS
  'Records a reasoned additive or subtractive stock movement atomically for active employees and administrators; resulting quantities are derived under a row lock.';
COMMENT ON FUNCTION public.quick_restock(uuid, uuid, numeric, date, numeric) IS
  'Registers stock atomically for active employees and administrators. Supplier-package cost is derived internally; manual cost override is administrator-only.';
COMMENT ON FUNCTION public.fraction_stock(uuid, uuid, numeric, numeric, numeric, numeric, public.stock_lot_status) IS
  'Registers stock fractioning atomically for active employees and administrators and validates all quantity changes against locked lot and presentation rows.';
