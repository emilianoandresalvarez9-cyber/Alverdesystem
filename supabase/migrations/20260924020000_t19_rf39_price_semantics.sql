-- Rollback the heuristic price check to comply strictly with RF-39 (Offline semantics).
-- If the offline POS sends a price, we must accept it as the valid offline price at the time of sale,
-- and optionally log a warning, but NEVER reject the sale based on central price drift.

CREATE OR REPLACE FUNCTION process_offline_sale(payload jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_local_id text;
    v_total_amount numeric;
    v_payment_method text;
    v_occurred_at timestamp;
    v_items jsonb;
    v_item record;
    
    v_sale_id uuid;
    v_item_price numeric;
    v_item_quantity numeric;
    v_item_subtotal numeric;
    v_catalog_price numeric;
    
    v_total_calculated numeric := 0;
BEGIN
    -- 1. Extraer cabecera
    v_local_id := payload->>'local_id';
    v_total_amount := (payload->>'total_amount')::numeric;
    v_occurred_at := (payload->>'occurred_at')::timestamp;
    v_items := payload->'items';

    -- Control de idemptotencia
    IF EXISTS (SELECT 1 FROM sales WHERE local_id = v_local_id) THEN
        RETURN; 
    END IF;

    -- Validar array
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RAISE EXCEPTION 'La venta offline no tiene items.';
    END IF;

    -- 2. Recorrer y validar items
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_item_quantity := (v_item.value->>'quantity')::numeric;
        v_item_price := (v_item.value->>'unit_price')::numeric;
        v_item_subtotal := (v_item.value->>'subtotal')::numeric;

        IF v_item_quantity IS NULL OR v_item_price IS NULL THEN
            RAISE EXCEPTION 'Item invalido: precio o cantidad NULL.';
        END IF;

        IF v_item_quantity <= 0 THEN
            RAISE EXCEPTION 'Item invalido: cantidad debe ser positiva.';
        END IF;
        
        IF v_item_price < 0 THEN
            RAISE EXCEPTION 'Item invalido: precio debe ser positivo.';
        END IF;

        -- Sumar al total verificado
        v_total_calculated := v_total_calculated + round(v_item_quantity * v_item_price, 2);
    END LOOP;

    -- Map payment method safely without catching generic exception
    IF (payload->>'payment_method') IN ('cash', 'credit_card', 'debit_card', 'transfer', 'credit') THEN
        v_payment_method := payload->>'payment_method';
    ELSE
        v_payment_method := 'cash';
    END IF;

    -- 3. Crear venta
    INSERT INTO sales (local_id, total_amount, payment_method, occurred_at, status)
    VALUES (v_local_id, v_total_calculated, v_payment_method::public.payment_method, v_occurred_at, 'completed')
    RETURNING id INTO v_sale_id;

    -- 4. Insertar items y descontar stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_item_quantity := (v_item.value->>'quantity')::numeric;
        v_item_price := (v_item.value->>'unit_price')::numeric;
        v_item_subtotal := round(v_item_quantity * v_item_price, 2);

        INSERT INTO sale_items (sale_id, presentation_id, quantity, unit_price, subtotal)
        VALUES (
            v_sale_id, 
            (v_item.value->>'presentation_id')::uuid, 
            v_item_quantity, 
            v_item_price, 
            v_item_subtotal
        );

        -- Descontar stock general (trigger FEFO handles stock_lots)
        UPDATE product_presentations
        SET stock_quantity = stock_quantity - v_item_quantity
        WHERE id = (v_item.value->>'presentation_id')::uuid;

        -- Loggear warning de drift de precio (sin cancelar la venta, respetando RF-39)
        SELECT sale_price INTO v_catalog_price 
        FROM product_presentations 
        WHERE id = (v_item.value->>'presentation_id')::uuid;

        IF found AND v_item_price <> v_catalog_price THEN
             INSERT INTO stock_warnings (product_id, message)
             VALUES (
                 (SELECT product_id FROM product_presentations WHERE id = (v_item.value->>'presentation_id')::uuid),
                 'Precio offline diferio del catalogo actual: cobrado ' || v_item_price || ' vs central ' || v_catalog_price
             );
        END IF;
    END LOOP;

    -- 5. Manejo de fiados
    IF v_payment_method = 'credit' THEN
        IF payload->>'customer_id' IS NULL THEN
            RAISE EXCEPTION 'Venta por credito requiere customer_id.';
        END IF;

        INSERT INTO credit_movements (customer_id, sale_id, amount, type, description)
        VALUES (
            (payload->>'customer_id')::uuid,
            v_sale_id,
            v_total_calculated,
            'charge',
            'Compra offline a credito'
        );
    END IF;

END;
$$;
