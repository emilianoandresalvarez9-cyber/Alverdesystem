-- Deterministic fixtures for local Playwright flows. Keep this as one SQL
-- statement because `supabase db query --file` sends a prepared statement.
WITH branch AS (
  INSERT INTO public.branches (id, name)
  VALUES ('10000000-0000-0000-0000-000000000001', 'Central')
  ON CONFLICT (id) DO UPDATE SET name = excluded.name
  RETURNING id
), register AS (
  INSERT INTO public.registers (id, branch_id, name)
  SELECT '10000000-0000-0000-0000-000000000002', branch.id, 'Caja E2E'
  FROM branch
  ON CONFLICT (id) DO UPDATE SET name = excluded.name
  RETURNING id
), sale_product AS (
  INSERT INTO public.products (id, name, brand_id, base_unit, manufacturer_barcode)
  SELECT
    '10000000-0000-0000-0000-000000000003',
    'Almendra E2E',
    brands.id,
    'unit'::public.base_unit,
    '7790000000007'
  FROM public.brands
  WHERE brands.name = 'Del local'
  ON CONFLICT (id) DO UPDATE
    SET name = excluded.name, manufacturer_barcode = excluded.manufacturer_barcode
  RETURNING id
), sale_presentation AS (
  INSERT INTO public.product_presentations (id, product_id, name, base_quantity, sale_price)
  SELECT '10000000-0000-0000-0000-000000000004', sale_product.id, 'Bolsa E2E', 1, 100
  FROM sale_product
  ON CONFLICT (id) DO UPDATE SET sale_price = excluded.sale_price
  RETURNING id
), sale_lot AS (
  INSERT INTO public.stock_lots (
    id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, received_at
  )
  SELECT
    '10000000-0000-0000-0000-000000000005',
    sale_presentation.id,
    10,
    10,
    50,
    'open',
    now()
  FROM sale_presentation
  ON CONFLICT (id) DO NOTHING
  RETURNING id
), bulk_product AS (
  INSERT INTO public.products (id, name, brand_id, base_unit, manufacturer_barcode)
  SELECT
    '10000000-0000-0000-0000-000000000006',
    'Lenteja E2E',
    brands.id,
    'gram'::public.base_unit,
    '7790000000008'
  FROM public.brands
  WHERE brands.name = 'Del local'
  ON CONFLICT (id) DO UPDATE
    SET name = excluded.name, manufacturer_barcode = excluded.manufacturer_barcode
  RETURNING id
), bulk_presentations AS (
  INSERT INTO public.product_presentations (
    id, product_id, name, base_quantity, sale_price, sold_by_weight
  )
  SELECT fixture.id, bulk_product.id, fixture.name, fixture.base_quantity,
         fixture.sale_price, fixture.sold_by_weight
  FROM (VALUES
    ('10000000-0000-0000-0000-000000000007'::uuid, 'Granel E2E', 1::numeric, 100::numeric, true),
    ('10000000-0000-0000-0000-000000000008'::uuid, 'Bolsa 100 g E2E', 100::numeric, 150::numeric, false)
  ) AS fixture(id, name, base_quantity, sale_price, sold_by_weight)
  CROSS JOIN bulk_product
  ON CONFLICT (id) DO UPDATE
    SET name = excluded.name,
        base_quantity = excluded.base_quantity,
        sale_price = excluded.sale_price,
        sold_by_weight = excluded.sold_by_weight
  RETURNING id, name
), bulk_lot AS (
  INSERT INTO public.stock_lots (
    id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, received_at
  )
  SELECT
    '10000000-0000-0000-0000-000000000009',
    bulk_presentations.id,
    1000,
    1000,
    10,
    'open',
    now()
  FROM bulk_presentations
  WHERE bulk_presentations.name = 'Granel E2E'
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
SELECT
  (SELECT count(*) FROM branch) AS branches,
  (SELECT count(*) FROM register) AS registers,
  (SELECT count(*) FROM sale_lot) AS sale_lots,
  (SELECT count(*) FROM bulk_lot) AS bulk_lots;
