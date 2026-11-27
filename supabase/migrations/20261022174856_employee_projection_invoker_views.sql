-- Keep the public API views SECURITY INVOKER while preserving the narrow employee
-- projections that need to read rows protected by admin-only base-table RLS.
-- The SECURITY DEFINER functions live in the non-exposed private schema, require an
-- active application profile, and return only the columns already intended for each view.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.employee_catalog_projection()
returns table (
  product_id uuid,
  product_name text,
  manufacturer_barcode text,
  base_unit public.base_unit,
  open_shelf_life_days integer,
  label_text text,
  brand_id uuid,
  brand_name text,
  category_id uuid,
  category_name text,
  presentation_id uuid,
  presentation_name text,
  base_quantity numeric(14, 3),
  internal_barcode text,
  sale_price numeric(14, 2),
  sold_by_weight boolean,
  labels jsonb,
  branch_prices jsonb
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    p.id,
    p.name,
    p.manufacturer_barcode,
    p.base_unit,
    p.open_shelf_life_days,
    p.label_text,
    b.id,
    b.name,
    c.id,
    c.name,
    pr.id,
    pr.name,
    pr.base_quantity,
    pr.internal_barcode,
    pr.sale_price,
    pr.sold_by_weight,
    coalesce(
      jsonb_agg(distinct jsonb_build_object('id', l.id, 'name', l.name))
        filter (where l.id is not null),
      '[]'::jsonb
    ),
    coalesce((
      select jsonb_object_agg(bp.branch_id::text, bp.sale_price)
      from public.branch_prices bp
      join public.branches br on br.id = bp.branch_id and br.archived_at is null
      where bp.presentation_id = pr.id
    ), '{}'::jsonb)
  from public.products p
  join public.product_presentations pr on pr.product_id = p.id and pr.active
  left join public.brands b on b.id = p.brand_id
  left join public.categories c on c.id = p.category_id
  left join public.product_labels pl on pl.product_id = p.id
  left join public.labels l on l.id = pl.label_id and l.archived_at is null
  where p.active and public.current_app_role() is not null
  group by p.id, b.id, c.id, pr.id
$function$;

create or replace function private.employee_stock_lots_projection()
returns table (
  id uuid,
  presentation_id uuid,
  supplier_id uuid,
  initial_quantity numeric(14, 3),
  current_quantity numeric(14, 3),
  received_at timestamptz,
  manufacturer_expiry_date date,
  opened_at timestamptz,
  portioned_at timestamptz,
  status public.stock_lot_status,
  effective_expiry_date date,
  product_id uuid,
  product_name text,
  base_unit public.base_unit,
  open_shelf_life_days integer,
  presentation_name text,
  base_quantity numeric(14, 3),
  sold_by_weight boolean,
  supplier_name text,
  created_at timestamptz,
  branch_id uuid,
  branch_name text
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    sl.id,
    sl.presentation_id,
    sl.supplier_id,
    sl.initial_quantity,
    sl.current_quantity,
    sl.received_at,
    sl.manufacturer_expiry_date,
    sl.opened_at,
    sl.portioned_at,
    sl.status,
    public.effective_expiry_date(sl.manufacturer_expiry_date, sl.opened_at, p.open_shelf_life_days),
    p.id,
    p.name,
    p.base_unit,
    p.open_shelf_life_days,
    pr.name,
    pr.base_quantity,
    pr.sold_by_weight,
    s.name,
    sl.created_at,
    sl.branch_id,
    b.name
  from public.stock_lots sl
  join public.product_presentations pr on pr.id = sl.presentation_id
  join public.products p on p.id = pr.product_id
  join public.branches b on b.id = sl.branch_id
  left join public.suppliers s on s.id = sl.supplier_id
  where public.current_app_role() is not null
    and (public.is_administrator() or sl.branch_id = public.current_branch_id())
$function$;

create or replace function private.customer_accounts_projection()
returns table (
  id uuid,
  name text,
  phone text,
  credit_limit numeric(14, 2),
  active boolean,
  balance numeric(14, 2),
  last_movement_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    c.id,
    c.name,
    c.phone,
    c.credit_limit,
    c.active,
    coalesce(sum(public.credit_movement_delta(m.kind, m.amount, m.adjustment_sign)), 0)::numeric(14, 2),
    max(m.occurred_at)
  from public.customers c
  left join public.credit_movements m on m.customer_id = c.id
  where public.current_app_role() is not null
  group by c.id
$function$;

revoke all on function private.employee_catalog_projection() from public, anon;
revoke all on function private.employee_stock_lots_projection() from public, anon;
revoke all on function private.customer_accounts_projection() from public, anon;
grant execute on function private.employee_catalog_projection() to authenticated;
grant execute on function private.employee_stock_lots_projection() to authenticated;
grant execute on function private.customer_accounts_projection() to authenticated;

create or replace view public.employee_catalog
with (security_invoker = true, security_barrier = true)
as
select
  product_id,
  product_name,
  manufacturer_barcode,
  base_unit,
  open_shelf_life_days,
  label_text,
  brand_id,
  brand_name,
  category_id,
  category_name,
  presentation_id,
  presentation_name,
  base_quantity::numeric(14, 3) as base_quantity,
  internal_barcode,
  sale_price::numeric(14, 2) as sale_price,
  sold_by_weight,
  labels,
  branch_prices
from private.employee_catalog_projection();

create or replace view public.employee_stock_lots
with (security_invoker = true, security_barrier = true)
as
select
  id,
  presentation_id,
  supplier_id,
  initial_quantity::numeric(14, 3) as initial_quantity,
  current_quantity::numeric(14, 3) as current_quantity,
  received_at,
  manufacturer_expiry_date,
  opened_at,
  portioned_at,
  status,
  effective_expiry_date,
  product_id,
  product_name,
  base_unit,
  open_shelf_life_days,
  presentation_name,
  base_quantity::numeric(14, 3) as base_quantity,
  sold_by_weight,
  supplier_name,
  created_at,
  branch_id,
  branch_name
from private.employee_stock_lots_projection();

create or replace view public.customer_accounts
with (security_invoker = true, security_barrier = true)
as
select
  id,
  name,
  phone,
  credit_limit::numeric(14, 2) as credit_limit,
  active,
  balance::numeric(14, 2) as balance,
  last_movement_at
from private.customer_accounts_projection();

revoke all on public.employee_catalog from public, anon, authenticated;
revoke all on public.employee_stock_lots from public, anon, authenticated;
revoke all on public.customer_accounts from public, anon, authenticated;
grant select on public.employee_catalog to authenticated;
grant select on public.employee_stock_lots to authenticated;
grant select on public.customer_accounts to authenticated;

comment on view public.employee_catalog is
  'SECURITY INVOKER API projection. A private guarded function returns active catalog fields only; it excludes price multipliers and costs.';
comment on view public.employee_stock_lots is
  'SECURITY INVOKER API projection. A private guarded function scopes employees to their branch and excludes purchase_cost.';
comment on view public.customer_accounts is
  'SECURITY INVOKER API projection. A private guarded function exposes customer balances only to active staff without exposing the movement ledger.';

