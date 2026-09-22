-- Alverde · Fase 0
-- This migration is the source of truth for the operational data model.
-- Apply with: supabase db push (after linking the intended project).

create extension if not exists pgcrypto;

create type public.app_role as enum ('administrator', 'employee');
create type public.base_unit as enum ('gram', 'millilitre', 'unit');
create type public.stock_lot_status as enum ('open', 'closed');
create type public.sale_status as enum ('closed', 'voided');
create type public.payment_method as enum ('cash', 'transfer', 'qr', 'credit');
create type public.stock_movement_kind as enum (
  'receipt', 'sale', 'portioning', 'waste', 'adjustment', 'discard'
);
create type public.credit_movement_kind as enum ('charge', 'payment', 'adjustment');
create type public.offline_operation_kind as enum ('sale', 'stock_movement', 'credit_movement');

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  address text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.registers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (branch_id, name)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) > 0),
  role public.app_role not null default 'employee',
  branch_id uuid references public.branches(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.categories(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (parent_id, name)
);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  manufacturer_barcode text unique,
  brand_id uuid references public.brands(id),
  category_id uuid references public.categories(id),
  base_unit public.base_unit not null,
  price_multiplier numeric(8, 3) check (price_multiplier > 0),
  open_shelf_life_days integer check (open_shelf_life_days > 0),
  label_text text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_labels (
  product_id uuid not null references public.products(id) on delete cascade,
  label_id uuid not null references public.labels(id),
  primary key (product_id, label_id)
);

create table public.product_presentations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  name text not null check (char_length(trim(name)) > 0),
  base_quantity numeric(14, 3) not null check (base_quantity > 0),
  internal_barcode text unique,
  sale_price numeric(14, 2) not null default 0 check (sale_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (internal_barcode is null or internal_barcode ~ '^[0-9]{13}$')
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  contact text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name)
);

-- Costs live here, never in the employee-facing catalogue view.
create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  supplier_id uuid not null references public.suppliers(id),
  supplier_product_code text,
  cost numeric(14, 2) not null check (cost >= 0),
  last_purchase_at timestamptz,
  is_primary boolean not null default false,
  unique (product_id, supplier_id)
);
create unique index one_primary_supplier_per_product
  on public.supplier_products(product_id) where is_primary;

create table public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.product_presentations(id),
  sale_price numeric(14, 2) not null check (sale_price >= 0),
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

-- Cost is intentionally kept only on this restricted table.
create table public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.product_presentations(id),
  supplier_id uuid references public.suppliers(id),
  initial_quantity numeric(14, 3) not null check (initial_quantity >= 0),
  current_quantity numeric(14, 3) not null check (current_quantity >= 0),
  purchase_cost numeric(14, 2) not null check (purchase_cost >= 0),
  received_at timestamptz not null default now(),
  manufacturer_expiry_date date,
  opened_at timestamptz,
  portioned_at timestamptz,
  status public.stock_lot_status not null default 'closed',
  created_at timestamptz not null default now(),
  check (current_quantity <= initial_quantity)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  phone text,
  credit_limit numeric(14, 2) check (credit_limit >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null unique,
  branch_id uuid not null references public.branches(id),
  register_id uuid not null references public.registers(id),
  user_id uuid not null references public.profiles(id),
  customer_id uuid references public.customers(id),
  payment_method public.payment_method not null,
  status public.sale_status not null default 'closed',
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  presentation_id uuid not null references public.product_presentations(id),
  lot_id uuid references public.stock_lots(id),
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  local_id uuid not null unique
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null unique,
  kind public.stock_movement_kind not null,
  product_id uuid not null references public.products(id),
  lot_id uuid references public.stock_lots(id),
  quantity numeric(14, 3) not null check (quantity <> 0),
  reason text,
  user_id uuid not null references public.profiles(id),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.credit_movements (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null unique,
  customer_id uuid not null references public.customers(id),
  sale_id uuid references public.sales(id),
  kind public.credit_movement_kind not null,
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  user_id uuid not null references public.profiles(id),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.audit_history (
  id bigint generated always as identity primary key,
  entity text not null,
  entity_id uuid not null,
  field text not null,
  old_value jsonb,
  new_value jsonb,
  user_id uuid references public.profiles(id),
  occurred_at timestamptz not null default now()
);

-- The cloud side of the append-only offline queue. local_id + device_id makes retries idempotent.
create table public.offline_operations (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null,
  device_id uuid not null,
  kind public.offline_operation_kind not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  received_by uuid not null references public.profiles(id),
  unique (device_id, local_id)
);

create index products_active_name_idx on public.products(active, name);
create index stock_lots_fefo_idx on public.stock_lots(status, manufacturer_expiry_date, opened_at);
create index sales_occurred_at_idx on public.sales(occurred_at desc);
create index stock_movements_product_idx on public.stock_movements(product_id, occurred_at desc);
create index credit_movements_customer_idx on public.credit_movements(customer_id, occurred_at desc);
create index audit_history_entity_idx on public.audit_history(entity, entity_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger presentations_set_updated_at before update on public.product_presentations
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'administrator', false)
$$;

create or replace function public.prevent_product_deletion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Los productos no se eliminan; deben archivarse.';
end;
$$;

create trigger products_cannot_be_deleted before delete on public.products
  for each row execute function public.prevent_product_deletion();

create or replace function public.audit_product_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb := coalesce(to_jsonb(old), '{}'::jsonb);
  new_row jsonb := to_jsonb(new);
  key_name text;
begin
  for key_name in select jsonb_object_keys(new_row)
  loop
    if tg_op = 'INSERT' or old_row -> key_name is distinct from new_row -> key_name then
      insert into public.audit_history(entity, entity_id, field, old_value, new_value, user_id)
      values (
        'product',
        new.id,
        key_name,
        case when tg_op = 'INSERT' then null else old_row -> key_name end,
        new_row -> key_name,
        auth.uid()
      );
    end if;
  end loop;
  return new;
end;
$$;

create trigger products_audit after insert or update on public.products
  for each row execute function public.audit_product_changes();

create or replace function public.effective_expiry_date(
  manufacturer_expiry date,
  opened_at_value timestamptz,
  shelf_life_days integer
)
returns date
language sql
immutable
as $$
  select least(
    coalesce(manufacturer_expiry, 'infinity'::date),
    coalesce((opened_at_value::date + shelf_life_days), 'infinity'::date)
  )
$$;

-- It does not expose product multiplier, supplier cost, lot cost, or historical costs.
create view public.employee_catalog
with (security_invoker = false)
as
select
  p.id as product_id,
  p.name as product_name,
  p.manufacturer_barcode,
  p.base_unit,
  p.label_text,
  b.name as brand_name,
  c.name as category_name,
  pr.id as presentation_id,
  pr.name as presentation_name,
  pr.base_quantity,
  pr.internal_barcode,
  pr.sale_price,
  coalesce(
    jsonb_agg(distinct jsonb_build_object('id', l.id, 'name', l.name))
      filter (where l.id is not null),
    '[]'::jsonb
  ) as labels
from public.products p
join public.product_presentations pr on pr.product_id = p.id and pr.active
left join public.brands b on b.id = p.brand_id
left join public.categories c on c.id = p.category_id
left join public.product_labels pl on pl.product_id = p.id
left join public.labels l on l.id = pl.label_id and l.archived_at is null
where p.active
group by p.id, b.name, c.name, pr.id;

-- A restricted operational lot projection for employees; purchase_cost is deliberately absent.
create view public.employee_stock_lots
with (security_invoker = false)
as
select
  sl.id, sl.presentation_id, sl.supplier_id, sl.initial_quantity, sl.current_quantity,
  sl.received_at, sl.manufacturer_expiry_date, sl.opened_at, sl.portioned_at, sl.status,
  public.effective_expiry_date(sl.manufacturer_expiry_date, sl.opened_at, p.open_shelf_life_days) as effective_expiry_date
from public.stock_lots sl
join public.product_presentations pr on pr.id = sl.presentation_id
join public.products p on p.id = pr.product_id;

-- Atomic, append-only processing for queued local events.
create or replace function public.apply_offline_operation(p_operation jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id uuid := (p_operation ->> 'localId')::uuid;
  v_device_id uuid := (p_operation ->> 'deviceId')::uuid;
  v_kind public.offline_operation_kind := (p_operation ->> 'kind')::public.offline_operation_kind;
  v_occurred_at timestamptz := coalesce((p_operation ->> 'createdAt')::timestamptz, now());
  v_payload jsonb := p_operation -> 'payload';
  v_sale_id uuid;
  v_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.offline_operations(local_id, device_id, kind, payload, occurred_at, received_by)
  values (v_local_id, v_device_id, v_kind, v_payload, v_occurred_at, auth.uid())
  on conflict (device_id, local_id) do nothing;

  if not found then
    return true;
  end if;

  if v_kind = 'sale' then
    insert into public.sales(
      local_id, branch_id, register_id, user_id, customer_id, payment_method, occurred_at
    )
    values (
      v_local_id,
      (v_payload ->> 'branchId')::uuid,
      (v_payload ->> 'registerId')::uuid,
      auth.uid(),
      nullif(v_payload ->> 'customerId', '')::uuid,
      (v_payload ->> 'paymentMethod')::public.payment_method,
      v_occurred_at
    )
    returning id into v_sale_id;

    for v_item in select value from jsonb_array_elements(coalesce(v_payload -> 'items', '[]'::jsonb))
    loop
      insert into public.sale_items(local_id, sale_id, presentation_id, lot_id, quantity, unit_price)
      values (
        coalesce(nullif(v_item ->> 'localId', '')::uuid, gen_random_uuid()),
        v_sale_id,
        (v_item ->> 'presentationId')::uuid,
        nullif(v_item ->> 'lotId', '')::uuid,
        (v_item ->> 'quantity')::numeric,
        (v_item ->> 'unitPrice')::numeric
      );
    end loop;
  elsif v_kind = 'stock_movement' then
    insert into public.stock_movements(local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at)
    values (
      v_local_id,
      (v_payload ->> 'movementKind')::public.stock_movement_kind,
      (v_payload ->> 'productId')::uuid,
      nullif(v_payload ->> 'lotId', '')::uuid,
      (v_payload ->> 'quantity')::numeric,
      v_payload ->> 'reason',
      auth.uid(),
      v_occurred_at
    );
  elsif v_kind = 'credit_movement' then
    insert into public.credit_movements(local_id, customer_id, sale_id, kind, amount, note, user_id, occurred_at)
    values (
      v_local_id,
      (v_payload ->> 'customerId')::uuid,
      nullif(v_payload ->> 'saleId', '')::uuid,
      (v_payload ->> 'movementKind')::public.credit_movement_kind,
      (v_payload ->> 'amount')::numeric,
      v_payload ->> 'note',
      auth.uid(),
      v_occurred_at
    );
  end if;

  return true;
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to authenticated;
grant select on public.employee_catalog, public.employee_stock_lots to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.apply_offline_operation(jsonb) to authenticated;

alter table public.branches enable row level security;
alter table public.registers enable row level security;
alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.labels enable row level security;
alter table public.products enable row level security;
alter table public.product_labels enable row level security;
alter table public.product_presentations enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_products enable row level security;
alter table public.product_price_history enable row level security;
alter table public.stock_lots enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.credit_movements enable row level security;
alter table public.audit_history enable row level security;
alter table public.offline_operations enable row level security;

create policy "admins manage branches" on public.branches for all using (public.is_administrator()) with check (public.is_administrator());
create policy "staff read branches" on public.branches for select using (auth.uid() is not null);
create policy "admins manage registers" on public.registers for all using (public.is_administrator()) with check (public.is_administrator());
create policy "staff read registers" on public.registers for select using (auth.uid() is not null);

create policy "profile self read" on public.profiles for select using (id = auth.uid() or public.is_administrator());
create policy "admins manage profiles" on public.profiles for all using (public.is_administrator()) with check (public.is_administrator());

create policy "admins manage brands" on public.brands for all using (public.is_administrator()) with check (public.is_administrator());
create policy "staff read brands" on public.brands for select using (auth.uid() is not null);
create policy "admins manage categories" on public.categories for all using (public.is_administrator()) with check (public.is_administrator());
create policy "staff read categories" on public.categories for select using (auth.uid() is not null);
create policy "admins manage labels" on public.labels for all using (public.is_administrator()) with check (public.is_administrator());
create policy "staff read labels" on public.labels for select using (auth.uid() is not null);

create policy "admins manage products" on public.products for all using (public.is_administrator()) with check (public.is_administrator());
create policy "admins manage product labels" on public.product_labels for all using (public.is_administrator()) with check (public.is_administrator());
create policy "admins manage presentations" on public.product_presentations for all using (public.is_administrator()) with check (public.is_administrator());
create policy "admins manage suppliers" on public.suppliers for all using (public.is_administrator()) with check (public.is_administrator());
create policy "staff read suppliers" on public.suppliers for select using (auth.uid() is not null);
create policy "admins manage supplier costs" on public.supplier_products for all using (public.is_administrator()) with check (public.is_administrator());
create policy "admins manage price history" on public.product_price_history for all using (public.is_administrator()) with check (public.is_administrator());
create policy "admins manage lots" on public.stock_lots for all using (public.is_administrator()) with check (public.is_administrator());

create policy "staff read customers" on public.customers for select using (auth.uid() is not null);
create policy "staff create customers" on public.customers for insert with check (auth.uid() is not null);
create policy "admins manage customers" on public.customers for all using (public.is_administrator()) with check (public.is_administrator());

create policy "staff read own sales" on public.sales for select using (user_id = auth.uid() or public.is_administrator());
create policy "staff read own sale items" on public.sale_items for select using (
  exists (select 1 from public.sales s where s.id = sale_id and (s.user_id = auth.uid() or public.is_administrator()))
);
create policy "staff read own stock movements" on public.stock_movements for select using (user_id = auth.uid() or public.is_administrator());
create policy "staff read credit movements" on public.credit_movements for select using (user_id = auth.uid() or public.is_administrator());
create policy "staff read offline receipts" on public.offline_operations for select using (received_by = auth.uid() or public.is_administrator());

create policy "admins read audit history" on public.audit_history for select using (public.is_administrator());

-- All writes that can occur offline go through apply_offline_operation(), not direct table mutations.
