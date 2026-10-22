-- A-03 (RF-14, RF-16): Cuando la bolsa de origen queda abierta ('open'), el servidor calcula el
-- remanente con la cantidad actual bloqueada del lote (v_origin_quantity - v_grams_needed) en vez
-- de exigir que coincida con p_new_origin_quantity (calculado con la foto previa de la pantalla),
-- evitando que una venta en el medio rechace el fraccionamiento con 22023.

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
SET search_path TO 'public'
AS $function$
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
  v_origin_branch_id uuid;
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
  IF p_packets_num IS NULL OR p_packets_num::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_packets_num <= 0 OR p_packets_num <> trunc(p_packets_num) THEN
    RAISE EXCEPTION 'La cantidad de paquetes debe ser un entero mayor que cero.' USING ERRCODE = '22023';
  END IF;
  IF p_grams_needed::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_merma::text IN ('NaN', 'Infinity', '-Infinity')
     OR (p_new_origin_quantity IS NOT NULL AND p_new_origin_quantity::text IN ('NaN', 'Infinity', '-Infinity')) THEN
    RAISE EXCEPTION 'Las cantidades del fraccionamiento deben ser finitas.' USING ERRCODE = '22023';
  END IF;
  IF p_origin_lot_status IS NULL THEN
    RAISE EXCEPTION 'Debe indicar si la bolsa de origen queda abierta o terminada.' USING ERRCODE = '22023';
  END IF;

  SELECT pp.product_id, sl.supplier_id, sl.purchase_cost, pp.base_quantity,
         pp.sold_by_weight, sl.received_at, sl.manufacturer_expiry_date,
         coalesce(sl.opened_at, now()), sl.current_quantity, sl.status, sl.branch_id
    INTO v_origin_product_id, v_origin_supplier_id, v_origin_cost,
         v_origin_base_quantity, v_origin_sold_by_weight, v_origin_received_at,
         v_origin_expiry, v_origin_opened_at, v_origin_quantity, v_origin_status, v_origin_branch_id
  FROM public.stock_lots sl
  JOIN public.product_presentations pp ON pp.id = sl.presentation_id
  WHERE sl.id = p_origin_lot_id
  FOR UPDATE OF sl;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote origen no encontrado.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.assert_lot_branch_access(p_origin_lot_id);
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
    IF p_merma IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'El remanente o la merma no coinciden con los valores calculados.' USING ERRCODE = '22023';
    END IF;
    v_real_remaining := v_theoretical_remaining;
    v_merma := 0;
  ELSE
    v_real_remaining := p_new_origin_quantity;
    IF v_real_remaining IS NULL OR v_real_remaining < 0 OR v_real_remaining > v_theoretical_remaining THEN
      RAISE EXCEPTION 'El remanente real debe estar entre cero y el remanente teórico.' USING ERRCODE = '22023';
    END IF;
    v_merma := round(v_theoretical_remaining - v_real_remaining, 3);
    IF p_new_origin_quantity IS DISTINCT FROM v_real_remaining OR p_merma IS DISTINCT FROM v_merma THEN
      RAISE EXCEPTION 'El remanente o la merma no coinciden con los valores calculados.' USING ERRCODE = '22023';
    END IF;
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
    received_at, manufacturer_expiry_date, opened_at, portioned_at, status, branch_id
  ) VALUES (
    p_target_presentation_id, v_origin_supplier_id, p_packets_num, p_packets_num,
    v_target_cost, v_origin_received_at, v_origin_expiry, now(), now(), 'open', v_origin_branch_id
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
$function$;

REVOKE EXECUTE ON FUNCTION public.fraction_stock(uuid, uuid, numeric, numeric, numeric, numeric, public.stock_lot_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fraction_stock(uuid, uuid, numeric, numeric, numeric, numeric, public.stock_lot_status) TO authenticated, service_role;
