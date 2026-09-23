-- Reemplazo de vista employee_catalog para proveer IDs y open_shelf_life_days necesarios para el frontend

DROP VIEW IF EXISTS public.employee_catalog;
CREATE VIEW public.employee_catalog
WITH (security_invoker = false)
AS
SELECT
  p.id as product_id,
  p.name as product_name,
  p.manufacturer_barcode,
  p.base_unit,
  p.open_shelf_life_days,
  p.label_text,
  b.id as brand_id,
  b.name as brand_name,
  c.id as category_id,
  c.name as category_name,
  pr.id as presentation_id,
  pr.name as presentation_name,
  pr.base_quantity,
  pr.internal_barcode,
  pr.sale_price,
  COALESCE(
    jsonb_agg(DISTINCT jsonb_build_object('id', l.id, 'name', l.name))
      FILTER (WHERE l.id IS NOT NULL),
    '[]'::jsonb
  ) as labels
FROM public.products p
JOIN public.product_presentations pr ON pr.product_id = p.id AND pr.active
LEFT JOIN public.brands b ON b.id = p.brand_id
LEFT JOIN public.categories c ON c.id = p.category_id
LEFT JOIN public.product_labels pl ON pl.product_id = p.id
LEFT JOIN public.labels l ON l.id = pl.label_id AND l.archived_at IS NULL
WHERE p.active
GROUP BY p.id, b.id, c.id, pr.id;

-- Correccion de politicas para missing_items (Faltantes)
DROP POLICY IF EXISTS "Autenticados pueden ver faltantes" ON public.missing_items;
CREATE POLICY "Autenticados pueden ver faltantes"
    ON public.missing_items FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Autenticados pueden reportar faltantes" ON public.missing_items;
CREATE POLICY "Autenticados pueden reportar faltantes"
    ON public.missing_items FOR INSERT TO authenticated WITH CHECK (reported_by = auth.uid());
