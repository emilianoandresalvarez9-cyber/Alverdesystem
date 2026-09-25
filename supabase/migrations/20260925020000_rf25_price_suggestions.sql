-- RF-25: configurable price multipliers and supplier purchase units.

alter table public.supplier_products
  add column purchase_quantity numeric(14, 3) check (purchase_quantity > 0);

comment on column public.supplier_products.purchase_quantity is
  'Amount of the product base unit included in the supplier package whose total cost is recorded in cost.';

create table public.pricing_settings (
  id smallint primary key check (id = 1),
  default_multiplier numeric(8, 3) not null default 2 check (default_multiplier > 0),
  updated_at timestamptz not null default now()
);

insert into public.pricing_settings (id, default_multiplier) values (1, 2);

create table public.category_price_multipliers (
  category_id uuid primary key references public.categories(id) on delete cascade,
  multiplier numeric(8, 3) not null check (multiplier > 0),
  updated_at timestamptz not null default now()
);

alter table public.pricing_settings enable row level security;
alter table public.category_price_multipliers enable row level security;

revoke all on public.pricing_settings, public.category_price_multipliers from anon, authenticated, public;
grant select, insert, update, delete on public.pricing_settings, public.category_price_multipliers to authenticated;

create policy "admins manage pricing settings"
  on public.pricing_settings for all
  using (public.is_administrator()) with check (public.is_administrator());
create policy "admins manage category price multipliers"
  on public.category_price_multipliers for all
  using (public.is_administrator()) with check (public.is_administrator());

create or replace function public.save_supplier_product_cost(
  p_product_id uuid,
  p_supplier_id uuid,
  p_cost numeric,
  p_purchase_quantity numeric,
  p_supplier_product_code text default null,
  p_is_primary boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_administrator() then
    raise exception 'Solo la administradora puede modificar costos de proveedores.' using errcode = '42501';
  end if;
  if p_cost is null or p_cost < 0 or p_purchase_quantity is null or p_purchase_quantity <= 0 then
    raise exception 'El costo debe ser cero o mayor y la cantidad de compra debe ser mayor que cero.' using errcode = '22023';
  end if;

  if p_is_primary then
    update public.supplier_products
       set is_primary = false
     where product_id = p_product_id and supplier_id <> p_supplier_id and is_primary;
  end if;

  insert into public.supplier_products (
    product_id, supplier_id, supplier_product_code, cost, purchase_quantity, last_purchase_at, is_primary
  ) values (
    p_product_id, p_supplier_id, nullif(trim(p_supplier_product_code), ''), p_cost, p_purchase_quantity, now(), p_is_primary
  )
  on conflict (product_id, supplier_id) do update set
    supplier_product_code = excluded.supplier_product_code,
    cost = excluded.cost,
    purchase_quantity = excluded.purchase_quantity,
    last_purchase_at = excluded.last_purchase_at,
    is_primary = excluded.is_primary;
end;
$$;

revoke execute on function public.save_supplier_product_cost(uuid, uuid, numeric, numeric, text, boolean) from anon, public;
grant execute on function public.save_supplier_product_cost(uuid, uuid, numeric, numeric, text, boolean) to authenticated;
