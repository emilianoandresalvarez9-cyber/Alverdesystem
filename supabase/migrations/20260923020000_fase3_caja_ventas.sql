-- Fase 3: Caja, Ventas, Clientes y Fiado
-- Todas las tablas mantienen nomenclatura en inglés y seguridad RLS.

-- 1. Clientes
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Fiados / Cuenta Corriente
CREATE TABLE IF NOT EXISTS public.customer_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('charge', 'payment')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- 3. Turnos de Caja
CREATE TABLE IF NOT EXISTS public.cash_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    initial_balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
    final_balance NUMERIC(10, 2),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- 4. Ventas (Cabecera)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES public.cash_shifts(id),
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'qr', 'credit')),
    customer_id UUID REFERENCES public.customers(id),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided')),
    offline_local_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- 5. Ítems de Venta (Detalle)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    lot_id UUID REFERENCES public.stock_lots(id),
    quantity NUMERIC(10, 3) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Políticas Básicas (Accesibles para autenticados, el filtrado fuerte de costos se mantiene en vistas)
CREATE POLICY "Enable read access for authenticated users on customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users on customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users on customers" ON public.customers FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable read for authenticated users on customer_credits" ON public.customer_credits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users on customer_credits" ON public.customer_credits FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users on cash_shifts" ON public.cash_shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users on cash_shifts" ON public.cash_shifts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users on cash_shifts" ON public.cash_shifts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable read for authenticated users on sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users on sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for administrators on sales" ON public.sales FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'administrator')
);

CREATE POLICY "Enable read for authenticated users on sale_items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users on sale_items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);

-- Triggers de Auditoría (Reutilizando log_audit_change de Fase 1)
CREATE TRIGGER audit_customers_changes AFTER UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();
CREATE TRIGGER audit_sales_changes AFTER UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();
