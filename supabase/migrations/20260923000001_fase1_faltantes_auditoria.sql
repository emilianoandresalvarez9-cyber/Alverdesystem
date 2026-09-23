-- ==============================================================================
-- Alverde System — Migración Fase 1 (missing_items + triggers de auditoría)
-- Cubre: RF-49/50 (faltantes) y RF-58 (historial de cambios)
--
-- Idempotente: usa IF NOT EXISTS / CREATE OR REPLACE / DROP TRIGGER IF EXISTS
-- Los nombres de columna de audit_history coinciden con la migración de Fase 0:
--   entity, entity_id, field, old_value, new_value, user_id, occurred_at
-- ==============================================================================

-- ==============================================================================
-- 1. TABLA missing_items (Faltantes — RF-49/50)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.missing_items (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    reported_by uuid        NOT NULL REFERENCES public.profiles(id),
    note        text,
    resolved    boolean     NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.missing_items ENABLE ROW LEVEL SECURITY;

-- Política: cualquier usuario autenticado puede ver faltantes
DROP POLICY IF EXISTS "Autenticados pueden ver faltantes" ON public.missing_items;
CREATE POLICY "Autenticados pueden ver faltantes"
    ON public.missing_items FOR SELECT
    TO authenticated
    USING (true);

-- Política: cualquier usuario autenticado puede reportar faltantes
DROP POLICY IF EXISTS "Autenticados pueden reportar faltantes" ON public.missing_items;
CREATE POLICY "Autenticados pueden reportar faltantes"
    ON public.missing_items FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Política: solo administradores pueden resolver (UPDATE) faltantes
DROP POLICY IF EXISTS "Solo admins pueden resolver faltantes" ON public.missing_items;
CREATE POLICY "Solo admins pueden resolver faltantes"
    ON public.missing_items FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'administrator'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'administrator'
        )
    );

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_missing_items_updated_at ON public.missing_items;
CREATE TRIGGER trg_missing_items_updated_at
    BEFORE UPDATE ON public.missing_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 2. FUNCIÓN TRIGGER DE AUDITORÍA (RF-58)
--
-- Itera columna por columna sobre OLD y NEW usando jsonb_each_text.
-- Solo registra columnas que efectivamente cambiaron (IS DISTINCT FROM).
-- Excluye campos técnicos que siempre cambian: updated_at, created_at, id.
-- Se ejecuta con SECURITY DEFINER para garantizar el log aunque el usuario
-- no tenga permisos directos sobre audit_history.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.log_audit_change()
RETURNS trigger AS $$
DECLARE
    v_old_json  jsonb;
    v_new_json  jsonb;
    v_key       text;
    v_old_val   text;
    v_new_val   text;
    v_entity_id uuid;
    v_user_id   uuid;
BEGIN
    v_entity_id := NEW.id;

    -- Obtener el uid del usuario que hace el cambio.
    -- Si el cambio viene de un proceso interno (sin sesión), queda NULL.
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);

    -- Iterar sobre cada campo del registro modificado
    FOR v_key, v_new_val IN
        SELECT key, value FROM jsonb_each_text(v_new_json)
    LOOP
        -- Ignorar campos técnicos que cambian en cada UPDATE
        CONTINUE WHEN v_key IN ('updated_at', 'created_at', 'id');

        v_old_val := v_old_json ->> v_key;

        -- Registrar solo si el valor realmente cambió (NULL-safe)
        IF v_old_val IS DISTINCT FROM v_new_val THEN
            INSERT INTO public.audit_history (
                entity,
                entity_id,
                field,
                old_value,
                new_value,
                user_id,
                occurred_at
            ) VALUES (
                TG_TABLE_NAME,
                v_entity_id,
                v_key,
                to_jsonb(v_old_val),
                to_jsonb(v_new_val),
                v_user_id,
                now()
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 3. ASIGNAR EL TRIGGER A LAS TABLAS PRINCIPALES
-- DROP + CREATE para idempotencia completa
-- ==============================================================================

-- products
DROP TRIGGER IF EXISTS trg_audit_products ON public.products;
CREATE TRIGGER trg_audit_products
    AFTER UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

-- brands
DROP TRIGGER IF EXISTS trg_audit_brands ON public.brands;
CREATE TRIGGER trg_audit_brands
    AFTER UPDATE ON public.brands
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

-- categories
DROP TRIGGER IF EXISTS trg_audit_categories ON public.categories;
CREATE TRIGGER trg_audit_categories
    AFTER UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

-- labels
DROP TRIGGER IF EXISTS trg_audit_labels ON public.labels;
CREATE TRIGGER trg_audit_labels
    AFTER UPDATE ON public.labels
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

-- product_presentations
DROP TRIGGER IF EXISTS trg_audit_product_presentations ON public.product_presentations;
CREATE TRIGGER trg_audit_product_presentations
    AFTER UPDATE ON public.product_presentations
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();
