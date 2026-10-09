-- RF-28 / RF-30: actualización masiva de precios con vista previa, aplicación atómica
-- y lista de reetiquetado.
--
-- Hasta ahora el navegador actualizaba presentación por presentación: si se cortaba a la
-- mitad quedaban precios mezclados, no había vista previa y no se podía filtrar por
-- proveedor. Ahora todo pasa por una RPC:
--   * bulk_update_prices(..., p_apply => false) devuelve qué cambiaría, sin tocar nada.
--   * bulk_update_prices(..., p_apply => true) aplica todo en una sola transacción y deja
--     registrado el lote en price_update_batches; cada fila del historial de precios
--     guarda el precio anterior y el lote al que pertenece (RF-30: "solo los que cambiaron").

-- ---------- 1. Lotes de actualización ----------
create table public.price_update_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  percent numeric(8, 3) not null,
  scope text not null check (scope in ('all', 'brand', 'category', 'supplier')),
  scope_id uuid,
  round_to numeric(14, 2),
  changed_count integer not null default 0 check (changed_count >= 0)
);

alter table public.price_update_batches enable row level security;
revoke all on public.price_update_batches from anon, authenticated, public;
grant select on public.price_update_batches to authenticated;
create policy "admins read price update batches"
  on public.price_update_batches for select
  using (public.is_administrator());

-- ---------- 2. Historial: precio anterior y lote ----------
alter table public.product_price_history
  add column previous_price numeric(14, 2) check (previous_price is null or previous_price >= 0),
  add column batch_id uuid references public.price_update_batches(id);

create index product_price_history_batch_idx on public.product_price_history (batch_id)
  where batch_id is not null;

create or replace function public.log_price_history_on_update()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.sale_price is distinct from old.sale_price) then
    insert into public.product_price_history (presentation_id, sale_price, previous_price, changed_by, batch_id)
    values (
      new.id,
      new.sale_price,
      case when tg_op = 'UPDATE' then old.sale_price else null end,
      auth.uid(),
      nullif(current_setting('alverde.price_batch', true), '')::uuid
    );
  end if;
  return new;
end;
$$;

revoke all on function public.log_price_history_on_update() from public, anon;

-- ---------- 3. RPC ----------
create or replace function public.bulk_update_prices(
  p_percent numeric,
  p_scope text default 'all',
  p_scope_id uuid default null,
  p_apply boolean default false,
  p_round_to numeric default 100
)
returns table (
  batch_id uuid,
  presentation_id uuid,
  product_id uuid,
  product_name text,
  presentation_name text,
  old_price numeric,
  new_price numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch uuid;
  v_factor numeric;
  v_count integer;
begin
  if not public.is_administrator() then
    raise exception 'Solo la administradora puede actualizar precios en bloque.' using errcode = '42501';
  end if;
  if p_percent is null or p_percent = 0 or p_percent <= -100 then
    raise exception 'El porcentaje tiene que ser distinto de cero y mayor que -100.' using errcode = '22023';
  end if;
  if p_scope not in ('all', 'brand', 'category', 'supplier') then
    raise exception 'Alcance inválido: %', p_scope using errcode = '22023';
  end if;
  if p_scope <> 'all' and p_scope_id is null then
    raise exception 'Falta indicar la marca, el rubro o el proveedor.' using errcode = '22023';
  end if;
  if p_round_to is not null and p_round_to <= 0 then
    raise exception 'El redondeo tiene que ser mayor que cero.' using errcode = '22023';
  end if;

  v_factor := 1 + p_percent / 100;

  drop table if exists _price_changes;
  create temp table _price_changes on commit drop as
  select
    pp.id as presentation_id,
    pr.id as product_id,
    pr.name as product_name,
    pp.name as presentation_name,
    pp.sale_price as old_price,
    case
      when p_round_to is null then round(pp.sale_price * v_factor, 2)
      else greatest(p_round_to, round(pp.sale_price * v_factor / p_round_to) * p_round_to)
    end as new_price
  from public.product_presentations pp
  join public.products pr on pr.id = pp.product_id
  where pp.active
    and pr.active
    and (
      p_scope = 'all'
      or (p_scope = 'brand' and pr.brand_id = p_scope_id)
      or (p_scope = 'category' and pr.category_id = p_scope_id)
      or (p_scope = 'supplier' and exists (
        select 1 from public.supplier_products sp
        where sp.product_id = pr.id and sp.supplier_id = p_scope_id
      ))
    );

  delete from _price_changes c where c.new_price = c.old_price;

  if p_apply then
    select count(*) into v_count from _price_changes;
    insert into public.price_update_batches (created_by, percent, scope, scope_id, round_to, changed_count)
    values (auth.uid(), p_percent, p_scope, p_scope_id, p_round_to, v_count)
    returning id into v_batch;

    -- El trigger del historial lee este ajuste para etiquetar cada fila con el lote.
    perform set_config('alverde.price_batch', v_batch::text, true);

    update public.product_presentations pp
       set sale_price = c.new_price,
           updated_at = now()
      from _price_changes c
     where pp.id = c.presentation_id;

    perform set_config('alverde.price_batch', '', true);
  end if;

  return query
  select v_batch, c.presentation_id, c.product_id, c.product_name, c.presentation_name, c.old_price, c.new_price
  from _price_changes c
  order by c.product_name, c.presentation_name;
end;
$$;

revoke execute on function public.bulk_update_prices(numeric, text, uuid, boolean, numeric) from anon, public;
grant execute on function public.bulk_update_prices(numeric, text, uuid, boolean, numeric) to authenticated;

-- ---------- 4. Lista de reetiquetado (RF-30) ----------
-- Qué cambió en un lote: producto, presentación, precio anterior y nuevo. Solo administrador.
create or replace function public.price_batch_changes(p_batch_id uuid)
returns table (
  presentation_id uuid,
  product_id uuid,
  product_name text,
  presentation_name text,
  internal_barcode text,
  old_price numeric,
  new_price numeric,
  changed_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select h.presentation_id, pr.id, pr.name, pp.name, pp.internal_barcode, h.previous_price, h.sale_price, h.changed_at
  from public.product_price_history h
  join public.product_presentations pp on pp.id = h.presentation_id
  join public.products pr on pr.id = pp.product_id
  where h.batch_id = p_batch_id
    and public.is_administrator()
  order by pr.name, pp.name;
$$;

revoke execute on function public.price_batch_changes(uuid) from anon, public;
grant execute on function public.price_batch_changes(uuid) to authenticated;
