-- RF-35/RF-57: persist each employee stock action locally first, then apply it
-- atomically and idempotently when the device reconnects.
CREATE OR REPLACE FUNCTION public.apply_offline_operation(p_operation jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.app_role := public.current_app_role();
  v_local_id uuid := (p_operation ->> 'localId')::uuid;
  v_device_id uuid := (p_operation ->> 'deviceId')::uuid;
  v_kind public.offline_operation_kind := (p_operation ->> 'kind')::public.offline_operation_kind;
  v_occurred_at timestamptz := coalesce((p_operation ->> 'createdAt')::timestamptz, now());
  v_payload jsonb := p_operation -> 'payload';
  v_action text := v_payload ->> 'action';
  v_credit_kind public.credit_movement_kind;
  v_movement_kind public.stock_movement_kind;
  v_sign smallint;
  v_product_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL OR v_role NOT IN ('administrator', 'employee') THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_local_id IS NULL OR v_device_id IS NULL OR v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object' THEN
    RAISE EXCEPTION 'La operación offline no tiene identificadores o datos válidos.' USING ERRCODE = '22023';
  END IF;
  IF v_kind = 'sale' THEN
    RAISE EXCEPTION 'Las ventas se registran con process_offline_sale.' USING ERRCODE = '22023';
  END IF;

  IF v_kind = 'stock_movement' THEN
    IF coalesce(nullif(v_payload ->> 'userId', '')::uuid, v_user_id) <> v_user_id THEN
      RAISE EXCEPTION 'La operación de stock pertenece a otro usuario.' USING ERRCODE = '42501';
    END IF;
  ELSIF v_kind = 'credit_movement' THEN
    v_credit_kind := (v_payload ->> 'movementKind')::public.credit_movement_kind;
    IF v_credit_kind = 'adjustment' THEN
      IF v_role <> 'administrator' THEN
        RAISE EXCEPTION 'Solo la administradora ajusta o perdona deudas (RF-48).' USING ERRCODE = '42501';
      END IF;
      v_sign := coalesce(nullif(v_payload ->> 'adjustmentSign', '')::smallint, -1);
    END IF;
  ELSIF v_kind = 'missing_item' THEN
    v_product_id := nullif(v_payload ->> 'productId', '')::uuid;
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'El aviso de faltante necesita productId.' USING ERRCODE = '22023';
    END IF;
  ELSIF v_kind NOT IN ('credit_movement', 'missing_item') THEN
    RAISE EXCEPTION 'Tipo de operación offline no admitido.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.offline_operations(local_id, device_id, kind, payload, occurred_at, received_by)
  VALUES (v_local_id, v_device_id, v_kind, v_payload, v_occurred_at, v_user_id)
  ON CONFLICT (device_id, local_id) DO NOTHING;

  -- A retry after a committed response loss is an acknowledged no-op. All
  -- stock writes below share the transaction with this idempotency record.
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF v_kind = 'stock_movement' THEN
    IF v_action = 'quick_restock' THEN
      PERFORM public.quick_restock(
        nullif(v_payload ->> 'presentationId', '')::uuid,
        nullif(v_payload ->> 'productId', '')::uuid,
        (v_payload ->> 'quantity')::numeric,
        nullif(v_payload ->> 'expiryDate', '')::date,
        NULL
      );
    ELSIF v_action = 'open_lot' THEN
      PERFORM public.open_stock_lot(nullif(v_payload ->> 'lotId', '')::uuid);
    ELSIF v_action = 'adjust_stock' THEN
      PERFORM public.adjust_stock(
        nullif(v_payload ->> 'lotId', '')::uuid,
        nullif(v_payload ->> 'productId', '')::uuid,
        (v_payload ->> 'movementKind')::public.stock_movement_kind,
        (v_payload ->> 'quantity')::numeric,
        v_payload ->> 'reason',
        NULL,
        false
      );
    ELSIF v_action = 'fraction_stock' THEN
      PERFORM public.fraction_stock(
        nullif(v_payload ->> 'originLotId', '')::uuid,
        nullif(v_payload ->> 'targetPresentationId', '')::uuid,
        (v_payload ->> 'packetsNum')::numeric,
        (v_payload ->> 'gramsNeeded')::numeric,
        (v_payload ->> 'merma')::numeric,
        (v_payload ->> 'newOriginQuantity')::numeric,
        (v_payload ->> 'originLotStatus')::public.stock_lot_status
      );
    ELSIF v_action IS NULL THEN
      -- Compatibility for old queued adjustments that predate the action field.
      v_movement_kind := (v_payload ->> 'movementKind')::public.stock_movement_kind;
      IF v_movement_kind NOT IN ('waste', 'discard', 'adjustment') THEN
        RAISE EXCEPTION 'Movimiento offline legado no admitido.' USING ERRCODE = '22023';
      END IF;
      PERFORM public.adjust_stock(
        nullif(v_payload ->> 'lotId', '')::uuid,
        nullif(v_payload ->> 'productId', '')::uuid,
        v_movement_kind,
        (v_payload ->> 'quantity')::numeric,
        v_payload ->> 'reason',
        NULL,
        false
      );
    ELSE
      RAISE EXCEPTION 'Acción de stock offline desconocida.' USING ERRCODE = '22023';
    END IF;
  ELSIF v_kind = 'credit_movement' THEN
    INSERT INTO public.credit_movements(local_id, customer_id, sale_id, kind, amount, adjustment_sign, note, user_id, occurred_at)
    VALUES (
      v_local_id,
      (v_payload ->> 'customerId')::uuid,
      nullif(v_payload ->> 'saleId', '')::uuid,
      v_credit_kind,
      (v_payload ->> 'amount')::numeric,
      v_sign,
      v_payload ->> 'note',
      v_user_id,
      v_occurred_at
    );
  ELSIF v_kind = 'missing_item' THEN
    -- Repeated reports of the same still-open item remain one actionable task.
    IF NOT EXISTS (SELECT 1 FROM public.missing_items WHERE product_id = v_product_id AND NOT resolved) THEN
      INSERT INTO public.missing_items(product_id, reported_by, note, created_at)
      VALUES (v_product_id, v_user_id, nullif(v_payload ->> 'note', ''), v_occurred_at);
    END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_offline_operation(jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_offline_operation(jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.apply_offline_operation(jsonb) IS
  'Idempotently applies queued sales-adjacent events. Employee/admin stock actions call the validated stock RPCs in the same transaction as the offline idempotency record.';

