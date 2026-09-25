-- Deterministic fixture for the local Playwright sale flow only.
with branch as (
  insert into public.branches (id, name)
  values ('10000000-0000-0000-0000-000000000001', 'Central')
  on conflict (id) do update set name = excluded.name
  returning id
), register as (
  insert into public.registers (id, branch_id, name)
  select
    '10000000-0000-0000-0000-000000000002',
    branch.id,
    'Caja E2E'
  from branch
  on conflict (id) do update set name = excluded.name
  returning id
), product as (
  insert into public.products (id, name, brand_id, base_unit)
  select
    '10000000-0000-0000-0000-000000000003',
    'Almendra E2E',
    brands.id,
    'unit'::public.base_unit
  from public.brands
  where brands.name = 'Del local'
  on conflict (id) do update set name = excluded.name
  returning id
), presentation as (
  insert into public.product_presentations (id, product_id, name, base_quantity, sale_price)
  select
    '10000000-0000-0000-0000-000000000004',
    product.id,
    'Bolsa E2E',
    1,
    100
  from product
  on conflict (id) do update set sale_price = excluded.sale_price
  returning id
), stock_lot as (
  insert into public.stock_lots (
    id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, received_at
  )
  select
    '10000000-0000-0000-0000-000000000005',
    presentation.id,
    10,
    10,
    50,
    'open',
    now()
  from presentation
  on conflict (id) do nothing
  returning id
)
select count(*) as seeded_lots from stock_lot;
