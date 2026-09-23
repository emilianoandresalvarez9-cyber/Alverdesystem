-- Fase 3 Corrección: Contratos de Base de Datos para Caja, Ventas y Clientes
-- Adaptamos la base canónica (Fase 0) en lugar de duplicar tablas.

-- 1. Turnos de Caja (Nuevo)
CREATE TABLE IF NOT EXISTS public.cash_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    register_id UUID NOT NULL REFERENCES public.registers(id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    initial_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    final_balance NUMERIC(14, 2),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;

-- 2. Clientes (Alterar existente)
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE TRIGGER customers_set_updated_at 
    BEFORE UPDATE ON public.customers 
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Ventas (Alterar existente)
-- Eliminamos restricciones de branch_id y register_id si se pasa shift_id (el shift_id ya pertenece a un register)
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.cash_shifts(id),
    ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    ALTER COLUMN branch_id DROP NOT NULL,
    ALTER COLUMN register_id DROP NOT NULL;

-- 4. Ítems de Venta (Alterar existente)
ALTER TABLE public.sale_items
    ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0;

-- Hacemos que local_id sea opcional en ítems si vamos a generarlo autómaticamente o ignorarlo en el offline sync
ALTER TABLE public.sale_items ALTER COLUMN local_id DROP NOT NULL;

-- 5. Seguridad (RLS) Estricta
DROP POLICY IF EXISTS "Enable read access for authenticated users on customers" ON public.customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users on customers" ON public.customers;
DROP POLICY IF EXISTS "Enable update for authenticated users on customers" ON public.customers;

DROP POLICY IF EXISTS "Enable read for authenticated users on sales" ON public.sales;
DROP POLICY IF EXISTS "Enable insert for authenticated users on sales" ON public.sales;
DROP POLICY IF EXISTS "Enable update for administrators on sales" ON public.sales;

DROP POLICY IF EXISTS "Enable read for authenticated users on sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users on sale_items" ON public.sale_items;

DROP POLICY IF EXISTS "Enable read for authenticated users on cash_shifts" ON public.cash_shifts;
DROP POLICY IF EXISTS "Enable insert for authenticated users on cash_shifts" ON public.cash_shifts;
DROP POLICY IF EXISTS "Enable update for authenticated users on cash_shifts" ON public.cash_shifts;

-- Políticas de Customers: Todos pueden leer, crear y actualizar clientes (asumimos acceso compartido para la sucursal)
CREATE POLICY "Empleados pueden ver clientes" ON public.customers FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Empleados pueden crear clientes" ON public.customers FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Empleados pueden actualizar clientes" ON public.customers FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- Políticas de Cash Shifts: Solo el cajero que abrió el turno puede operarlo, o los admins
CREATE POLICY "Empleados pueden ver sus turnos" ON public.cash_shifts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_administrator());
CREATE POLICY "Empleados pueden abrir turno" ON public.cash_shifts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Empleados pueden cerrar su turno" ON public.cash_shifts FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_administrator());

-- Políticas de Sales: El empleado ve sus propias ventas (o todas si es admin). Inserta a su nombre.
CREATE POLICY "Empleados ven sus ventas" ON public.sales FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_administrator());
CREATE POLICY "Empleados registran sus ventas" ON public.sales FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- Solo admins o el sistema pueden hacer UPDATE (anular venta)
CREATE POLICY "Admins pueden actualizar ventas" ON public.sales FOR UPDATE TO authenticated USING (public.is_administrator());

-- Políticas de Sale Items: Relacionadas a la venta.
CREATE POLICY "Lectura de ítems de venta" ON public.sale_items FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND (sales.user_id = auth.uid() OR public.is_administrator()))
);
CREATE POLICY "Inserción de ítems de venta" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid())
);

-- Auditoría
DROP TRIGGER IF EXISTS audit_customers_changes ON public.customers;
CREATE TRIGGER audit_customers_changes AFTER UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

DROP TRIGGER IF EXISTS audit_sales_changes ON public.sales;
CREATE TRIGGER audit_sales_changes AFTER UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();
