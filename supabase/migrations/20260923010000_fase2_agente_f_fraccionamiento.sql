-- ==============================================================================
-- Alverde System — Migración Fase 2 (Agente F: Fraccionamiento y Granel)
-- Cubre: RF-11 y RF-12 (Regla de oro del granel: una sola bolsa abierta por producto)
--
-- Idempotente: CREATE OR REPLACE FUNCTION / DROP TRIGGER IF EXISTS
-- ==============================================================================

-- 1. FUNCION TRIGGER: Regla de oro del granel (RF-11 y RF-12)
-- Impide que un producto tenga más de una bolsa/lote abierto activo simultáneamente.
-- Una bolsa se considera activa y abierta si:
--   - opened_at IS NOT NULL
--   - status = 'open'
--   - current_quantity > 0

CREATE OR REPLACE FUNCTION public.check_single_open_lot_per_product()
RETURNS trigger AS $$
DECLARE
    v_product_id uuid;
    v_conflict_lot_id uuid;
BEGIN
    -- Solo evaluar si el lote que se inserta o modifica está abierto físicamente y con stock disponible
    IF NEW.opened_at IS NOT NULL AND NEW.status = 'open' AND NEW.current_quantity > 0 THEN
        -- Obtener el producto al que pertenece la presentación del lote
        SELECT product_id INTO v_product_id
        FROM public.product_presentations
        WHERE id = NEW.presentation_id;

        IF v_product_id IS NOT NULL THEN
            -- Buscar si ya existe OTRO lote para el mismo producto que esté abierto y activo
            SELECT l.id INTO v_conflict_lot_id
            FROM public.stock_lots l
            JOIN public.product_presentations p ON l.presentation_id = p.id
            WHERE p.product_id = v_product_id
              AND l.id <> NEW.id
              AND l.opened_at IS NOT NULL
              AND l.status = 'open'
              AND l.current_quantity > 0
            LIMIT 1;

            IF v_conflict_lot_id IS NOT NULL THEN
                RAISE EXCEPTION 'Regla de oro del granel: Ya existe una bolsa abierta activa para este producto (Lote: %). No se puede abrir una segunda bolsa mientras la anterior siga activa (RF-11, RF-12).'
                    USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. TRIGGER EN TABLA stock_lots
DROP TRIGGER IF EXISTS trg_stock_lots_single_open ON public.stock_lots;
CREATE TRIGGER trg_stock_lots_single_open
    BEFORE INSERT OR UPDATE OF opened_at, status, current_quantity, presentation_id
    ON public.stock_lots
    FOR EACH ROW EXECUTE FUNCTION public.check_single_open_lot_per_product();
