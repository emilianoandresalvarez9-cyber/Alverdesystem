-- Deterministic fixture for the local Playwright sale flow only.
do $$
begin
insert into public.branches (id, name)
values ('10000000-0000-0000-0000-000000000001', 'Central')
on conflict (id) do nothing;

insert into public.registers (id, branch_id, name)
values (
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'Caja E2E'
)
on conflict (id) do nothing;

end
$$;

insert into public.products (id, name, brand_id, base_unit)
select
  '10000000-0000-0000-0000-000000000003',
  'Almendra E2E',
  id,
  'unit'::public.base_unit
from public.brands
where name = 'Del local'
on conflict (id) do nothing;

insert into public.product_presentations (id, product_id, name, base_quantity, sale_price)
values (
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000003',
  'Bolsa E2E',
  1,
  100
)
on conflict (id) do nothing;

insert into public.stock_lots (
  id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, received_at
)
values (
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000004',
  10,
  10,
  50,
  'open',
  now()
)
on conflict (id) do nothing;

end
$$;
