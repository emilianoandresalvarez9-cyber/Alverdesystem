-- ==============================================================================
-- Alverde System — Migración Fase 3 (Sincronización de Ventas Offline y FEFO)
-- Cubre: RF-35 a RF-37 (FEFO), RF-38 (Stock Negativo con Advertencia)
-- Corrección: Adaptado al esquema canónico de Fase 0 (sales, sale_items).
-- ==============================================================================

-- 1. Eliminar la restricción de cantidad positiva estricta en lotes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.stock_lots'::regclass
          AND pg_get_constraintdef(oid) LIKE '%current_quantity >= 0%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.stock_lots DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END$$;

-- 2. Crear tabla de advertencias para ventas con stock negativo (RF-38)
CREATE TABLE IF NOT EXISTS public.stock_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id UUID REFERENCES public.stock_lots(id),
    sale_id UUID REFERENCES public.sales(id),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read stock warnings" ON public.stock_warnings;
CREATE POLICY "Admins read stock warnings" 
ON public.stock_warnings FOR SELECT TO authenticated 
USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'administrator'
));

-- 3. Función RPC para procesar ventas offline con FEFO (RF-35 a RF-38)
CREATE OR REPLACE FUNCTION public.process_offline_sale(payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_local_id uuid := (payload ->> 'localId')::uuid;
  v_device_id uuid := (payload ->> 'deviceId')::uuid;
  v_kind public.offline_operation_kind := (payload ->> 'kind')::public.offline_operation_kind;
  v_occurred_at timestamptz := coalesce((payload ->> 'createdAt')::timestamptz, now());
  v_sale_payload jsonb := payload -> 'payload';
  v_sale_id uuid;
  v_item jsonb;
  v_presentation_id uuid;
  v_requested_qty numeric;
  v_remaining_qty numeric;
  v_fefo_lot record;
  v_deduct numeric;
  v_last_lot uuid;
  v_product_id uuid;
  v_payment_method public.payment_method;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Idempotencia: Registrar operación
  INSERT INTO public.offline_operations(local_id, device_id, kind, payload, occurred_at, received_by)
  VALUES (v_local_id, v_device_id, v_kind, v_sale_payload, v_occurred_at, auth.uid())
  ON CONFLICT (device_id, local_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN true; -- Ya procesado anteriormente
  END IF;

  -- Mapeo de enum de pago (default cash)
  BEGIN
    v_payment_method := (v_sale_payload ->> 'paymentMethod')::public.payment_method;
  EXCEPTION WHEN OTHERS THEN
    v_payment_method := 'cash'::public.payment_method;
  END;

  -- Crear cabecera de la venta (Esquema Fase 0 + Fase 3 FIX)
  INSERT INTO public.sales(
    local_id, shift_id, user_id, customer_id, payment_method, occurred_at, created_at, total_amount, status
  )
  VALUES (
    v_local_id,
    nullif(v_sale_payload ->> 'shiftId', '')::uuid,
    auth.uid(),
    nullif(v_sale_payload ->> 'customerId', '')::uuid,
    v_payment_method,
    v_occurred_at,
    v_occurred_at,
    (v_sale_payload ->> 'totalAmount')::numeric,
    'closed'::public.sale_status
  )
  RETURNING id INTO v_sale_id;

  -- Procesar items
  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(v_sale_payload -> 'items', '[]'::jsonb))
  LOOP
    v_presentation_id := (v_item ->> 'presentationId')::uuid;
    v_requested_qty := (v_item ->> 'quantity')::numeric;

    -- Guardar item de la venta (Esquema Fase 0 + Fase 3 FIX)
    INSERT INTO public.sale_items(
      sale_id, presentation_id, lot_id, quantity, unit_price, subtotal
    )
    VALUES (
      v_sale_id,
      v_presentation_id,
      nullif(v_item ->> 'lotId', '')::uuid,
      v_requested_qty,
      (v_item ->> 'unitPrice')::numeric,
      (v_item ->> 'unitPrice')::numeric * v_requested_qty
    );

    v_remaining_qty := v_requested_qty;

    -- Lógica FEFO
    FOR v_fefo_lot IN 
      SELECT id, current_quantity, status
      FROM public.stock_lots
      WHERE presentation_id = v_presentation_id
        AND current_quantity > 0
      ORDER BY 
        (status = 'open') DESC,
        manufacturer_expiry_date ASC NULLS LAST,
        opened_at ASC NULLS LAST,
        received_at ASC
      FOR UPDATE
    LOOP
      IF v_remaining_qty <= 0 THEN
        EXIT;
      END IF;

      IF v_fefo_lot.current_quantity >= v_remaining_qty THEN
        v_deduct := v_remaining_qty;
      ELSE
        v_deduct := v_fefo_lot.current_quantity;
      END IF;

      UPDATE public.stock_lots
      SET current_quantity = current_quantity - v_deduct
      WHERE id = v_fefo_lot.id;

      v_remaining_qty := v_remaining_qty - v_deduct;
    END LOOP;

    -- RF-38: Permitir stock negativo y marcar advertencia si falta descontar
    IF v_remaining_qty > 0 THEN
      -- Buscar el lote más reciente o de mayor prioridad para aplicar el saldo negativo
      SELECT id INTO v_last_lot
      FROM public.stock_lots
      WHERE presentation_id = v_presentation_id
      ORDER BY (status = 'open') DESC, manufacturer_expiry_date ASC NULLS LAST
      LIMIT 1
      FOR UPDATE;

      IF v_last_lot IS NOT NULL THEN
        UPDATE public.stock_lots
        SET current_quantity = current_quantity - v_remaining_qty
        WHERE id = v_last_lot;

        INSERT INTO public.stock_warnings (lot_id, sale_id, message)
        VALUES (v_last_lot, v_sale_id, 'Stock negativo: venta offline con faltante de ' || v_remaining_qty || ' unidades.');
      ELSE
        -- Si no hay lotes en absoluto, reportar faltante a nivel producto
        SELECT product_id INTO v_product_id FROM public.product_presentations WHERE id = v_presentation_id;
        INSERT INTO public.missing_items (product_id, reported_by, note)
        VALUES (v_product_id, auth.uid(), 'Venta offline sin lotes existentes. Faltante: ' || v_remaining_qty);
      END IF;
    END IF;

  END LOOP;

  RETURN true;
END;
$$;
