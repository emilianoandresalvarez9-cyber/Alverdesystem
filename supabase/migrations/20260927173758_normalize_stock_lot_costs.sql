-- P23 / RF-07, RF-14, RF-25 and RF-26: keep lot costs on the same unit as stock.
-- supplier_products.cost is the total price of a package and purchase_quantity is
-- its amount in base units. stock_lots.purchase_cost is the cost of one stock
-- unit for the lot's presentation (one gram for weight sales, one package for
-- fixed presentations).
COMMENT ON COLUMN public.stock_lots.purchase_cost IS
  'Cost of one stock unit in this lot presentation: one base unit for weight sales, otherwise one presentation.';

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
  v_product_id uuid;
  v_base_quantity numeric;
  v_sold_by_weight boolean;
  v_supplier_id uuid;
  v_cost_per_base_unit numeric;
  v_lot_unit_cost numeric;
  v_lot_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_administrator() THEN
    RAISE EXCEPTION 'Solo la administradora puede ingresar stock.' USING ERRCODE = '42501';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero.' USING ERRCODE = '22023';
  END IF;
  IF p_purchase_cost IS NOT NULL AND p_purchase_cost < 0 THEN
    RAISE EXCEPTION 'El costo no puede ser negativo.' USING ERRCODE = '22023';
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

  -- Read the current primary supplier atomically. If no usable package quantity
  -- has been recorded yet, accept the receipt with an unknown cost of zero.
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
    -- Retain the legacy optional override; its unit is one stock unit in this
    -- presentation, matching the stock_lots column contract above.
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
  v_origin_product_id uuid;
  v_origin_supplier_id uuid;
  v_origin_cost numeric;
  v_origin_base_quantity numeric;
  v_origin_sold_by_weight boolean;
  v_origin_received_at timestamptz;
  v_origin_expiry date;
  v_origin_opened_at timestamptz;
  v_target_product_id uuid;
  v_target_base_quantity numeric;
  v_target_sold_by_weight boolean;
  v_target_cost numeric;
  v_target_lot_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_administrator() THEN
    RAISE EXCEPTION 'Solo la administradora puede fraccionar stock.' USING ERRCODE = '42501';
  END IF;

  SELECT pp.product_id, sl.supplier_id, sl.purchase_cost, pp.base_quantity,
         pp.sold_by_weight, sl.received_at, sl.manufacturer_expiry_date,
         coalesce(sl.opened_at, now())
    INTO v_origin_product_id, v_origin_supplier_id, v_origin_cost,
         v_origin_base_quantity, v_origin_sold_by_weight, v_origin_received_at,
         v_origin_expiry, v_origin_opened_at
  FROM public.stock_lots sl
  JOIN public.product_presentations pp ON pp.id = sl.presentation_id
  WHERE sl.id = p_origin_lot_id
  FOR UPDATE OF sl;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote origen no encontrado.' USING ERRCODE = 'P0002';
  END IF;

  SELECT pp.product_id, pp.base_quantity, pp.sold_by_weight
    INTO v_target_product_id, v_target_base_quantity, v_target_sold_by_weight
  FROM public.product_presentations pp
  WHERE pp.id = p_target_presentation_id AND pp.active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presentación destino inexistente o inactiva.' USING ERRCODE = 'P0002';
  END IF;
  IF v_target_product_id IS DISTINCT FROM v_origin_product_id THEN
    RAISE EXCEPTION 'El destino debe ser otra presentación del mismo producto.' USING ERRCODE = '22023';
  END IF;

  -- Convert source presentation cost to cost/base-unit, then to one target
  -- stock unit. This changes a $40,000/25,000 g bulk lot into $240 per 150 g bag.
  v_target_cost := round(
    (v_origin_cost / CASE WHEN v_origin_sold_by_weight THEN 1 ELSE v_origin_base_quantity END)
    * CASE WHEN v_target_sold_by_weight THEN 1 ELSE v_target_base_quantity END,
    2
  );

  INSERT INTO public.stock_movements (
    local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
  ) VALUES (
    gen_random_uuid(), 'portioning', v_origin_product_id, p_origin_lot_id,
    -p_grams_needed, 'Fraccionamiento: ' || p_packets_num || ' unidades', v_user_id, now()
  );

  IF p_merma > 0 THEN
    INSERT INTO public.stock_movements (
      local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
    ) VALUES (
      gen_random_uuid(), 'waste', v_origin_product_id, p_origin_lot_id, -p_merma,
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
  SET current_quantity = p_new_origin_quantity,
      status = p_origin_lot_status,
      opened_at = v_origin_opened_at
  WHERE id = p_origin_lot_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.quick_restock(uuid, uuid, numeric, date, numeric) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.quick_restock(uuid, uuid, numeric, date, numeric) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fraction_stock(uuid, uuid, numeric, numeric, numeric, numeric, public.stock_lot_status) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fraction_stock(uuid, uuid, numeric, numeric, numeric, numeric, public.stock_lot_status) TO authenticated, service_role;

COMMENT ON FUNCTION public.quick_restock(uuid, uuid, numeric, date, numeric) IS
  'Registers stock atomically. When purchase_cost is omitted, derives per-stock-unit cost and supplier from the active primary supplier package.';
COMMENT ON FUNCTION public.fraction_stock(uuid, uuid, numeric, numeric, numeric, numeric, public.stock_lot_status) IS
  'Registers fractioning atomically and scales lot cost from the source stock unit to the target stock unit.';
