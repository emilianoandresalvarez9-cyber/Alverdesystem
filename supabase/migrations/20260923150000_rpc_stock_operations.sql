-- ==============================================================================
-- Alverde System - Migración Fase 1 (T-01: RPCs atómicas para stock)
-- Cubre: RF-51 (Ingreso rápido), RF-57 (Ajustes y mermas), RF-26 (Fraccionamiento)
-- ==============================================================================

-- 1. adjust_stock
CREATE OR REPLACE FUNCTION public.adjust_stock(
    p_lot_id uuid,
    p_product_id uuid,
    p_kind public.stock_movement_kind,
    p_quantity numeric,
    p_reason text,
    p_new_lot_quantity numeric,
    p_should_close_lot boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF NOT public.is_administrator() THEN
        RAISE EXCEPTION 'Solo la administradora puede ajustar el stock.' USING ERRCODE = '42501';
    END IF;

    -- 1. Registrar movimiento
    INSERT INTO public.stock_movements (
        local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
    ) VALUES (
        gen_random_uuid(), p_kind, p_product_id, p_lot_id, p_quantity, p_reason, v_user_id, now()
    );

    -- 2. Actualizar lote
    UPDATE public.stock_lots
    SET current_quantity = p_new_lot_quantity,
        status = CASE WHEN p_should_close_lot THEN 'closed'::public.stock_lot_status ELSE status END
    WHERE id = p_lot_id;
END;
$$;

-- 2. quick_restock
CREATE OR REPLACE FUNCTION public.quick_restock(
    p_presentation_id uuid,
    p_product_id uuid,
    p_quantity numeric,
    p_expiry_date date,
    p_purchase_cost numeric DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_lot_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF NOT public.is_administrator() THEN
        RAISE EXCEPTION 'Solo la administradora puede ingresar stock.' USING ERRCODE = '42501';
    END IF;

    -- 1. Insertar lote
    INSERT INTO public.stock_lots (
        presentation_id, initial_quantity, current_quantity, purchase_cost, status, manufacturer_expiry_date, received_at
    ) VALUES (
        p_presentation_id, p_quantity, p_quantity, p_purchase_cost, 'open', p_expiry_date, now()
    ) RETURNING id INTO v_lot_id;

    -- 2. Registrar movimiento
    INSERT INTO public.stock_movements (
        local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
    ) VALUES (
        gen_random_uuid(), 'receipt', p_product_id, v_lot_id, p_quantity, 'Ingreso rápido de mercadería (RF-51)', v_user_id, now()
    );

    RETURN v_lot_id;
END;
$$;

-- 3. fraction_stock
CREATE OR REPLACE FUNCTION public.fraction_stock(
    p_origin_lot_id uuid,
    p_target_presentation_id uuid,
    p_packets_num numeric,
    p_grams_needed numeric,
    p_merma numeric,
    p_new_origin_quantity numeric,
    p_origin_lot_status public.stock_lot_status
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_origin_product_id uuid;
    v_origin_supplier_id uuid;
    v_origin_cost numeric;
    v_origin_received_at timestamptz;
    v_origin_expiry date;
    v_origin_opened_at timestamptz;
    v_target_lot_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF NOT public.is_administrator() THEN
        RAISE EXCEPTION 'Solo la administradora puede fraccionar stock.' USING ERRCODE = '42501';
    END IF;

    -- Obtener info del lote origen
    SELECT pp.product_id, sl.supplier_id, sl.purchase_cost, sl.received_at, sl.manufacturer_expiry_date, coalesce(sl.opened_at, now())
    INTO v_origin_product_id, v_origin_supplier_id, v_origin_cost, v_origin_received_at, v_origin_expiry, v_origin_opened_at
    FROM public.stock_lots sl
    JOIN public.product_presentations pp ON sl.presentation_id = pp.id
    WHERE sl.id = p_origin_lot_id;

    IF v_origin_product_id IS NULL THEN
        RAISE EXCEPTION 'Lote origen no encontrado.';
    END IF;

    -- 1. Salida del lote origen
    INSERT INTO public.stock_movements (
        local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
    ) VALUES (
        gen_random_uuid(), 'portioning', v_origin_product_id, p_origin_lot_id, -p_grams_needed, 
        'Fraccionamiento: ' || p_packets_num || ' unidades', v_user_id, now()
    );

    -- 2. Merma (si hay)
    IF p_merma > 0 THEN
        INSERT INTO public.stock_movements (
            local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
        ) VALUES (
            gen_random_uuid(), 'waste', v_origin_product_id, p_origin_lot_id, -p_merma, 
            'Merma por cierre de bolsa en fraccionamiento', v_user_id, now()
        );
    END IF;

    -- 3. Crear lote destino
    INSERT INTO public.stock_lots (
        presentation_id, supplier_id, initial_quantity, current_quantity, purchase_cost, 
        received_at, manufacturer_expiry_date, opened_at, portioned_at, status
    ) VALUES (
        p_target_presentation_id, v_origin_supplier_id, p_packets_num, p_packets_num, v_origin_cost,
        v_origin_received_at, v_origin_expiry, now(), now(), 'open'
    ) RETURNING id INTO v_target_lot_id;

    -- 4. Entrada al lote destino
    INSERT INTO public.stock_movements (
        local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
    ) VALUES (
        gen_random_uuid(), 'portioning', v_origin_product_id, v_target_lot_id, p_packets_num, 
        'Alta por fraccionamiento desde lote origen', v_user_id, now()
    );

    -- 5. Actualizar lote origen
    UPDATE public.stock_lots
    SET current_quantity = p_new_origin_quantity,
        status = p_origin_lot_status,
        opened_at = v_origin_opened_at
    WHERE id = p_origin_lot_id;

END;
$$;
