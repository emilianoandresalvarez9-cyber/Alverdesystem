-- RF-25: supplier package costs and configurable pricing multipliers.
ALTER TABLE public.supplier_products
  ADD COLUMN purchase_quantity numeric(14, 3) CHECK (purchase_quantity > 0);

COMMENT ON COLUMN public.supplier_products.purchase_quantity IS
  'Amount of the product base unit included in the supplier package whose total cost is recorded in cost.';

CREATE TABLE public.pricing_settings (
  id smallint PRIMARY KEY CHECK (id = 1),
  default_multiplier numeric(8, 3) NOT NULL DEFAULT 2 CHECK (default_multiplier > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.pricing_settings (id, default_multiplier) VALUES (1, 2);

CREATE TABLE public.category_price_multipliers (
  category_id uuid PRIMARY KEY REFERENCES public.categories(id) ON DELETE CASCADE,
  multiplier numeric(8, 3) NOT NULL CHECK (multiplier > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_price_multipliers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pricing_settings, public.category_price_multipliers FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_settings, public.category_price_multipliers TO authenticated;

CREATE POLICY "admins manage pricing settings"
  ON public.pricing_settings FOR ALL
  USING (public.is_administrator()) WITH CHECK (public.is_administrator());
CREATE POLICY "admins manage category price multipliers"
  ON public.category_price_multipliers FOR ALL
  USING (public.is_administrator()) WITH CHECK (public.is_administrator());

-- Keep legacy data deterministic before enforcing one primary supplier per product.
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY product_id ORDER BY last_purchase_at DESC NULLS LAST, id
  ) AS position
  FROM public.supplier_products
  WHERE is_primary
)
UPDATE public.supplier_products sp
SET is_primary = false
FROM ranked
WHERE sp.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX supplier_products_one_primary_per_product_idx
  ON public.supplier_products (product_id)
  WHERE is_primary;

CREATE OR REPLACE FUNCTION public.save_supplier_product_cost(
  p_product_id uuid,
  p_supplier_id uuid,
  p_cost numeric,
  p_purchase_quantity numeric,
  p_supplier_product_code text DEFAULT null,
  p_is_primary boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_primary boolean;
BEGIN
  IF NOT public.is_administrator() THEN
    RAISE EXCEPTION 'Solo la administradora puede modificar costos de proveedores.' USING errcode = '42501';
  END IF;
  IF p_cost IS NULL OR p_cost < 0 OR p_purchase_quantity IS NULL OR p_purchase_quantity <= 0 THEN
    RAISE EXCEPTION 'El costo debe ser cero o mayor y la cantidad de compra debe ser mayor que cero.' USING errcode = '22023';
  END IF;

  -- Serialize provider changes for this product; the partial unique index
  -- remains a final guard against writes outside this RPC.
  PERFORM 1 FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto inexistente.' USING errcode = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND active) THEN
    RAISE EXCEPTION 'Proveedor inexistente o inactivo.' USING errcode = 'P0002';
  END IF;

  SELECT coalesce(p_is_primary, false) OR NOT EXISTS (
    SELECT 1 FROM public.supplier_products
    WHERE product_id = p_product_id AND supplier_id <> p_supplier_id AND is_primary
  ) INTO v_is_primary;

  IF v_is_primary THEN
    UPDATE public.supplier_products
       SET is_primary = false
     WHERE product_id = p_product_id AND supplier_id <> p_supplier_id AND is_primary;
  END IF;

  INSERT INTO public.supplier_products (
    product_id, supplier_id, supplier_product_code, cost, purchase_quantity, last_purchase_at, is_primary
  ) VALUES (
    p_product_id, p_supplier_id, nullif(trim(p_supplier_product_code), ''),
    p_cost, p_purchase_quantity, now(), v_is_primary
  )
  ON CONFLICT (product_id, supplier_id) DO UPDATE SET
    supplier_product_code = excluded.supplier_product_code,
    cost = excluded.cost,
    purchase_quantity = excluded.purchase_quantity,
    last_purchase_at = excluded.last_purchase_at,
    is_primary = excluded.is_primary;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_supplier_product_cost(uuid, uuid, numeric, numeric, text, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_supplier_product_cost(uuid, uuid, numeric, numeric, text, boolean) TO authenticated;
