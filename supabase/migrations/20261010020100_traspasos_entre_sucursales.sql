-- RF-68: solo la administradora traspasa mercadería de una sucursal a otra.
-- Es una sola operación: descuenta del lote de origen y crea en la sucursal de destino un
-- lote con el mismo producto, proveedor, costo, ingreso, vencimiento y apertura. Queda
-- registrado quién, cuándo, cuánto, desde qué lote y hacia qué sucursal.

create table public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null unique,
  from_lot_id uuid not null references public.stock_lots(id),
  to_lot_id uuid not null references public.stock_lots(id),
  from_branch_id uuid not null references public.branches(id),
  to_branch_id uuid not null references public.branches(id),
  quantity numeric(14, 3) not null check (quantity > 0),
  note text check (note is null or char_length(note) <= 500),
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (from_branch_id <> to_branch_id)
);
create index stock_transfers_created_idx on public.stock_transfers (created_at desc);

alter table public.stock_transfers enable row level security;
revoke all on public.stock_transfers from anon, authenticated, public;
grant select on public.stock_transfers to authenticated;
create policy "admins read stock transfers" on public.stock_transfers
  for select using (public.is_administrator());

create or replace function public.transfer_stock(
  p_lot_id uuid,
  p_to_branch_id uuid,
  p_quantity numeric,
  p_note text default null,
  p_local_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id uuid := coalesce(p_local_id, gen_random_uuid());
  v_existing uuid;
  v_lot record;
  v_product_id uuid;
  v_from_name text;
  v_to_name text;
  v_new_lot uuid;
  v_remaining numeric(14, 3);
begin
  if not public.is_administrator() then
    raise exception 'Solo la administradora traspasa mercadería entre sucursales (RF-68).' using errcode = '42501';
  end if;

  -- Idempotente: reintentar el mismo traspaso devuelve el lote ya creado.
  select to_lot_id into v_existing from public.stock_transfers where local_id = v_local_id;
  if found then
    return v_existing;
  end if;

  if p_quantity is null or p_quantity::text in ('NaN', 'Infinity', '-Infinity')
     or p_quantity <= 0 or p_quantity <> round(p_quantity, 3) then
    raise exception 'La cantidad a traspasar tiene que ser mayor que cero y tener hasta tres decimales.' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'La nota no puede superar 500 caracteres.' using errcode = '22023';
  end if;

  select sl.*, pr.product_id
    into v_lot
  from public.stock_lots sl
  join public.product_presentations pr on pr.id = sl.presentation_id
  where sl.id = p_lot_id
  for update of sl;
  if not found then
    raise exception 'Lote no encontrado.' using errcode = 'P0002';
  end if;
  v_product_id := v_lot.product_id;

  select name into v_to_name from public.branches where id = p_to_branch_id and archived_at is null;
  if not found then
    raise exception 'La sucursal de destino no existe o está archivada.' using errcode = 'P0002';
  end if;
  if p_to_branch_id = v_lot.branch_id then
    raise exception 'El lote ya está en esa sucursal.' using errcode = '22023';
  end if;
  if v_lot.status <> 'open' or v_lot.current_quantity <= 0 then
    raise exception 'Solo se traspasa desde un lote con stock disponible.' using errcode = '22023';
  end if;
  if p_quantity > v_lot.current_quantity then
    raise exception 'No alcanza: el lote tiene % y se quieren traspasar %.', v_lot.current_quantity, p_quantity using errcode = '22023';
  end if;
  select name into v_from_name from public.branches where id = v_lot.branch_id;

  v_remaining := v_lot.current_quantity - p_quantity;
  update public.stock_lots
     set current_quantity = v_remaining,
         status = case when v_remaining = 0 then 'closed'::public.stock_lot_status else status end
   where id = p_lot_id;

  -- Si el origen es una bolsa de granel abierta, la parte traspasada sigue abierta (mismo
  -- vencimiento efectivo). Si el destino ya tiene una bolsa abierta de ese producto, la regla
  -- de una bolsa abierta por sucursal (RF-12) rechaza el traspaso y no se descuenta nada.
  insert into public.stock_lots (
    presentation_id, supplier_id, initial_quantity, current_quantity, purchase_cost,
    received_at, manufacturer_expiry_date, opened_at, portioned_at, status, branch_id
  ) values (
    v_lot.presentation_id, v_lot.supplier_id, p_quantity, p_quantity, v_lot.purchase_cost,
    v_lot.received_at, v_lot.manufacturer_expiry_date, v_lot.opened_at, v_lot.portioned_at, 'open', p_to_branch_id
  )
  returning id into v_new_lot;

  insert into public.stock_movements (local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at)
  values
    (gen_random_uuid(), 'transfer', v_product_id, p_lot_id, -p_quantity,
     'Traspaso a ' || v_to_name || coalesce(': ' || nullif(trim(p_note), ''), ''), auth.uid(), now()),
    (gen_random_uuid(), 'transfer', v_product_id, v_new_lot, p_quantity,
     'Traspaso desde ' || v_from_name || coalesce(': ' || nullif(trim(p_note), ''), ''), auth.uid(), now());

  insert into public.stock_transfers (local_id, from_lot_id, to_lot_id, from_branch_id, to_branch_id, quantity, note, user_id)
  values (v_local_id, p_lot_id, v_new_lot, v_lot.branch_id, p_to_branch_id, p_quantity, nullif(trim(p_note), ''), auth.uid());

  return v_new_lot;
end;
$$;

revoke execute on function public.transfer_stock(uuid, uuid, numeric, text, uuid) from anon, public;
grant execute on function public.transfer_stock(uuid, uuid, numeric, text, uuid) to authenticated;

-- Historial de traspasos con nombres, para la pantalla (solo administradora).
create or replace function public.stock_transfers_list(p_branch_id uuid default null, p_limit integer default 100)
returns table (
  id uuid,
  created_at timestamptz,
  product_name text,
  presentation_name text,
  quantity numeric,
  base_unit text,
  from_branch_name text,
  to_branch_name text,
  user_name text,
  note text,
  from_lot_id uuid,
  to_lot_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.created_at, p.name, pp.name, t.quantity, p.base_unit::text,
         fb.name, tb.name, coalesce(u.display_name, t.user_id::text), t.note, t.from_lot_id, t.to_lot_id
  from public.stock_transfers t
  join public.stock_lots sl on sl.id = t.from_lot_id
  join public.product_presentations pp on pp.id = sl.presentation_id
  join public.products p on p.id = pp.product_id
  join public.branches fb on fb.id = t.from_branch_id
  join public.branches tb on tb.id = t.to_branch_id
  left join public.profiles u on u.id = t.user_id
  where public.is_administrator()
    and (p_branch_id is null or p_branch_id in (t.from_branch_id, t.to_branch_id))
  order by t.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke execute on function public.stock_transfers_list(uuid, integer) from anon, public;
grant execute on function public.stock_transfers_list(uuid, integer) to authenticated;
