-- RF-69: precio base + precio propio opcional por sucursal.
-- product_presentations.sale_price sigue siendo el precio BASE. branch_prices guarda el precio
-- de una sucursal solo donde difiere. Precio efectivo = propio de la sucursal o, si no hay, el base.
-- Lo usan: la vista del catálogo (también sin conexión), la caja, el control de precio de la venta,
-- la actualización masiva (por sucursal) y el historial de precios (con sucursal).

-- ---------- 1. Precios propios por sucursal ----------
create table public.branch_prices (
  branch_id uuid not null references public.branches(id),
  presentation_id uuid not null references public.product_presentations(id),
  sale_price numeric(14, 2) not null check (sale_price >= 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (branch_id, presentation_id)
);
create index branch_prices_presentation_idx on public.branch_prices (presentation_id);

alter table public.branch_prices enable row level security;
revoke all on public.branch_prices from anon, authenticated, public;
-- Los precios de venta no son secretos (RNF-04 protege costos y márgenes): todos los leen,
-- así la caja de cada sucursal los tiene sin conexión. Se escriben solo por RPC de administración.
grant select on public.branch_prices to authenticated;
create policy "staff read branch prices" on public.branch_prices
  for select using (auth.uid() is not null);

alter table public.product_price_history add column branch_id uuid references public.branches(id);
alter table public.price_update_batches add column branch_id uuid references public.branches(id);

-- ---------- 2. Precio efectivo ----------
create or replace function public.effective_sale_price(p_presentation_id uuid, p_branch_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select bp.sale_price from public.branch_prices bp
      where bp.presentation_id = p_presentation_id and bp.branch_id = p_branch_id),
    (select pp.sale_price from public.product_presentations pp where pp.id = p_presentation_id)
  );
$$;
revoke execute on function public.effective_sale_price(uuid, uuid) from anon, public;
grant execute on function public.effective_sale_price(uuid, uuid) to authenticated;

-- ---------- 3. Historial de precios por sucursal (RF-27 + RF-69) ----------
create or replace function public.log_branch_price_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base numeric;
begin
  if tg_op = 'UPDATE' and new.sale_price is not distinct from old.sale_price then
    return new;
  end if;
  select sale_price into v_base from public.product_presentations
   where id = coalesce(new.presentation_id, old.presentation_id);
  insert into public.product_price_history (presentation_id, sale_price, previous_price, changed_by, batch_id, branch_id)
  values (
    coalesce(new.presentation_id, old.presentation_id),
    case when tg_op = 'DELETE' then v_base else new.sale_price end,      -- al quitar el propio, rige el base
    case when tg_op = 'INSERT' then v_base else old.sale_price end,      -- al crear el propio, antes regía el base
    auth.uid(),
    nullif(current_setting('alverde.price_batch', true), '')::uuid,
    coalesce(new.branch_id, old.branch_id)
  );
  return coalesce(new, old);
end;
$$;
revoke all on function public.log_branch_price_history() from anon, public;
create trigger trg_branch_prices_history
  after insert or update or delete on public.branch_prices
  for each row execute function public.log_branch_price_history();

-- ---------- 4. Definir o quitar el precio propio (solo administración) ----------
create or replace function public.set_branch_price(p_presentation_id uuid, p_branch_id uuid, p_price numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_administrator() then
    raise exception 'Solo la administradora define precios (RF-69).' using errcode = '42501';
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and archived_at is null) then
    raise exception 'La sucursal no existe o está archivada.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.product_presentations where id = p_presentation_id) then
    raise exception 'Presentación inexistente.' using errcode = 'P0002';
  end if;

  if p_price is null then
    delete from public.branch_prices where branch_id = p_branch_id and presentation_id = p_presentation_id;
    return;
  end if;
  -- Dos decimales; en balanza el precio es por gramo, así el precio por kilo queda en múltiplo de $10.
  if p_price < 0 or p_price::text in ('NaN', 'Infinity') or p_price <> round(p_price, 2) then
    raise exception 'El precio tiene que ser cero o mayor y tener hasta dos decimales.' using errcode = '22023';
  end if;

  insert into public.branch_prices (branch_id, presentation_id, sale_price, updated_by)
  values (p_branch_id, p_presentation_id, p_price, auth.uid())
  on conflict (branch_id, presentation_id) do update
    set sale_price = excluded.sale_price, updated_by = excluded.updated_by, updated_at = now();
end;
$$;
revoke execute on function public.set_branch_price(uuid, uuid, numeric) from anon, public;
grant execute on function public.set_branch_price(uuid, uuid, numeric) to authenticated;

-- ---------- 5. Catálogo: precios propios de cada sucursal, también para la copia sin conexión ----------
create or replace view public.employee_catalog
with (security_invoker = false, security_barrier = true)
as
 SELECT p.id AS product_id,
    p.name AS product_name,
    p.manufacturer_barcode,
    p.base_unit,
    p.open_shelf_life_days,
    p.label_text,
    b.id AS brand_id,
    b.name AS brand_name,
    c.id AS category_id,
    c.name AS category_name,
    pr.id AS presentation_id,
    pr.name AS presentation_name,
    pr.base_quantity,
    pr.internal_barcode,
    pr.sale_price,
    pr.sold_by_weight,
    COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', l.id, 'name', l.name)) FILTER (WHERE l.id IS NOT NULL), '[]'::jsonb) AS labels,
    COALESCE((
      SELECT jsonb_object_agg(bp.branch_id::text, bp.sale_price)
      FROM branch_prices bp
      JOIN branches br ON br.id = bp.branch_id AND br.archived_at IS NULL
      WHERE bp.presentation_id = pr.id
    ), '{}'::jsonb) AS branch_prices
   FROM products p
     JOIN product_presentations pr ON pr.product_id = p.id AND pr.active
     LEFT JOIN brands b ON b.id = p.brand_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_labels pl ON pl.product_id = p.id
     LEFT JOIN labels l ON l.id = pl.label_id AND l.archived_at IS NULL
  WHERE p.active
  GROUP BY p.id, b.id, c.id, pr.id;

revoke all on public.employee_catalog from public, anon;
grant select on public.employee_catalog to authenticated;

-- ---------- 6. Venta: control de precio contra el precio de su sucursal ----------
CREATE OR REPLACE FUNCTION public.process_offline_sale(payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_local_id uuid := nullif(payload ->> 'localId', '')::uuid;
  v_device_id uuid := nullif(payload ->> 'deviceId', '')::uuid;
  v_occurred_at timestamptz := coalesce(nullif(payload ->> 'createdAt', '')::timestamptz, now());
  v_sale jsonb := coalesce(payload -> 'payload', '{}'::jsonb);
  v_items jsonb := coalesce(payload -> 'payload' -> 'items', '[]'::jsonb);
  v_payment_text text := v_sale ->> 'paymentMethod';
  v_payment public.payment_method;
  v_customer_id uuid := nullif(v_sale ->> 'customerId', '')::uuid;
  v_shift_id uuid := nullif(v_sale ->> 'shiftId', '')::uuid;
  v_client_total numeric := nullif(v_sale ->> 'totalAmount', '')::numeric;
  v_register_id uuid;
  v_branch_id uuid;
  v_shift_owner uuid;
  v_total numeric(14, 2);
  v_sale_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_presentation_id uuid;
    v_item_price numeric;
    v_catalog_price numeric;
  v_product_id uuid;
  v_qty numeric;
  v_remaining numeric;
  v_deduct numeric;
  v_lot record;
  v_lots_used integer;
  v_single_lot uuid;
  v_fallback_lot uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if payload ->> 'kind' is distinct from 'sale' then
    raise exception 'process_offline_sale solo acepta operaciones de tipo sale.' using errcode = '22023';
  end if;
  if v_local_id is null or v_device_id is null then
    raise exception 'La operación necesita localId y deviceId.' using errcode = '22023';
  end if;

  -- Idempotencia primero: un reintento de algo ya procesado no se vuelve a validar,
  -- porque el estado pudo cambiar (por ejemplo, el turno ya se cerró).
  if exists (select 1 from public.offline_operations where device_id = v_device_id and local_id = v_local_id) then
    return true;
  end if;

  if v_payment_text is null or not (v_payment_text = any (enum_range(null::public.payment_method)::text[])) then
    raise exception 'Medio de pago inválido: %. Valores válidos: cash, transfer, qr, credit.', coalesce(v_payment_text, '(vacío)')
      using errcode = '22023';
  end if;
  v_payment := v_payment_text::public.payment_method;

  if v_payment = 'credit' and v_customer_id is null then
    raise exception 'Una venta fiada necesita un cliente (RF-46).' using errcode = '22023';
  end if;

  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'La venta no tiene productos.' using errcode = '22023';
  end if;

  if v_shift_id is not null then
    select cs.user_id, cs.register_id, r.branch_id
      into v_shift_owner, v_register_id, v_branch_id
    from public.cash_shifts cs
    join public.registers r on r.id = cs.register_id
    where cs.id = v_shift_id;

    if not found then
      raise exception 'El turno % todavía no existe en la nube; se reintentará.', v_shift_id using errcode = 'P0002';
    end if;
    if v_shift_owner <> auth.uid() then
      raise exception 'El turno pertenece a otro usuario.' using errcode = '42501';
    end if;
  end if;

  -- RF-65/66: la venta descuenta de la sucursal de su caja; sin turno, de la del usuario.
  v_branch_id := coalesce(v_branch_id, public.current_branch_id());
  if v_branch_id is null then
    raise exception 'No hay una sucursal activa para registrar la venta.' using errcode = 'P0002';
  end if;

  -- El total lo calcula el servidor a partir de los ítems.
  select coalesce(sum(round((i ->> 'quantity')::numeric * (i ->> 'unitPrice')::numeric, 2)), 0)
    into v_total
  from jsonb_array_elements(v_items) i;

  insert into public.offline_operations(local_id, device_id, kind, payload, occurred_at, received_by)
  values (v_local_id, v_device_id, 'sale', v_sale, v_occurred_at, auth.uid())
  on conflict (device_id, local_id) do nothing;
  if not found then
    return true;
  end if;

  insert into public.sales(
    local_id, shift_id, register_id, branch_id, user_id, customer_id,
    payment_method, occurred_at, created_at, total_amount, status
  )
  values (
    v_local_id, v_shift_id, v_register_id, v_branch_id, auth.uid(), v_customer_id,
    v_payment, v_occurred_at, v_occurred_at, v_total, 'closed'
  )
  returning id into v_sale_id;

  if v_client_total is not null and abs(v_client_total - v_total) >= 0.01 then
    insert into public.stock_warnings (sale_id, message)
    values (v_sale_id, format('La caja informó un total de %s y el calculado es %s.', v_client_total, v_total));
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_presentation_id := (v_item ->> 'presentationId')::uuid;
    v_qty := (v_item ->> 'quantity')::numeric;
    v_item_price := (v_item ->> 'unitPrice')::numeric;
    
    
    if v_item_price is null then
      raise exception 'El precio unitario no puede ser negativo.' using errcode = '22023';
    end if;
    if v_qty is null then
      raise exception 'La cantidad no puede ser menor o igual a cero.' using errcode = '22023';
    end if;

    if v_item_price < 0 then
      raise exception 'El precio unitario no puede ser negativo.' using errcode = '22023';
    end if;
    if v_qty <= 0 then
      raise exception 'La cantidad no puede ser menor o igual a cero.' using errcode = '22023';
    end if;

    -- RF-69: el precio de referencia es el de la sucursal de la venta (propio o, si no tiene, el base).
    v_catalog_price := public.effective_sale_price(v_presentation_id, v_branch_id);
    if v_catalog_price is not null and v_item_price < (v_catalog_price * 0.5) then
      raise exception 'Precio offline sospechoso. Venta rechazada.' using errcode = '22023';
    end if;

    if v_catalog_price is not null and abs(v_catalog_price - v_item_price) >= 0.01 then
      insert into public.stock_warnings (sale_id, message)
      values (v_sale_id, format('Diferencia de precio en presentación %s: Cobrado $%s, Catálogo actual $%s.', v_presentation_id, v_item_price, v_catalog_price));
    end if;


    select product_id into v_product_id from public.product_presentations where id = v_presentation_id;
    if not found then
      raise exception 'Presentación inexistente: %', v_presentation_id using errcode = '23503';
    end if;

    insert into public.sale_items(local_id, sale_id, presentation_id, quantity, unit_price, subtotal)
    values (
      coalesce(nullif(v_item ->> 'localId', '')::uuid, gen_random_uuid()),
      v_sale_id,
      v_presentation_id,
      v_qty,
      (v_item ->> 'unitPrice')::numeric,
      round(v_qty * (v_item ->> 'unitPrice')::numeric, 2)
    )
    returning id into v_item_id;

    -- FEFO (RF-09) por vencimiento efectivo (RF-08). La bolsa abierta va primero (RF-12).
    v_remaining := v_qty;
    v_lots_used := 0;
    v_single_lot := null;
    for v_lot in
      select sl.id, sl.current_quantity
      from public.stock_lots sl
      join public.product_presentations pr on pr.id = sl.presentation_id
      join public.products p on p.id = pr.product_id
      where sl.presentation_id = v_presentation_id
        and sl.branch_id = v_branch_id
        and sl.current_quantity > 0
      order by
        (sl.status = 'open') desc,
        public.effective_expiry_date(sl.manufacturer_expiry_date, sl.opened_at, p.open_shelf_life_days) asc,
        sl.received_at asc,
        sl.id
      for update of sl
    loop
      exit when v_remaining <= 0;
      v_deduct := least(v_lot.current_quantity, v_remaining);

      update public.stock_lots set current_quantity = current_quantity - v_deduct where id = v_lot.id;
      insert into public.stock_movements(local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at)
      values (gen_random_uuid(), 'sale', v_product_id, v_lot.id, -v_deduct, 'Venta ' || v_local_id, auth.uid(), v_occurred_at);

      v_remaining := v_remaining - v_deduct;
      v_lots_used := v_lots_used + 1;
      v_single_lot := v_lot.id;
    end loop;

    -- RF-38: la venta no se bloquea; el faltante queda en negativo y marcado para revisión.
    if v_remaining > 0 then
      select sl.id into v_fallback_lot
      from public.stock_lots sl
      where sl.presentation_id = v_presentation_id
        and sl.branch_id = v_branch_id
      order by (sl.status = 'open') desc, sl.received_at desc, sl.id
      limit 1
      for update;

      if v_fallback_lot is not null then
        update public.stock_lots set current_quantity = current_quantity - v_remaining where id = v_fallback_lot;
        insert into public.stock_movements(local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at)
        values (gen_random_uuid(), 'sale', v_product_id, v_fallback_lot, -v_remaining, 'Venta ' || v_local_id || ' (stock negativo)', auth.uid(), v_occurred_at);
        insert into public.stock_warnings (lot_id, sale_id, message)
        values (v_fallback_lot, v_sale_id, format('Stock negativo: faltaron %s unidades de la presentación.', v_remaining));
        v_lots_used := v_lots_used + 1;
        v_single_lot := case when v_lots_used = 1 then v_fallback_lot else v_single_lot end;
      else
        insert into public.missing_items (product_id, reported_by, note, branch_id)
        values (v_product_id, auth.uid(), format('Venta sin lotes cargados en la sucursal. Faltante: %s.', v_remaining), v_branch_id);
        insert into public.stock_warnings (sale_id, message)
        values (v_sale_id, format('Venta sin lotes cargados en la sucursal para la presentación %s.', v_presentation_id));
      end if;
    end if;

    if v_lots_used = 1 then
      update public.sale_items set lot_id = v_single_lot where id = v_item_id;
    end if;
  end loop;

  -- RF-46: la venta fiada es un cargo en la cuenta del cliente.
  if v_payment = 'credit' and v_total > 0 then
    insert into public.credit_movements(local_id, customer_id, sale_id, kind, amount, note, user_id, occurred_at)
    values (v_local_id, v_customer_id, v_sale_id, 'charge', v_total, 'Venta fiada', auth.uid(), v_occurred_at);
  end if;

  return true;
end;
$function$;

-- ---------- 7. Actualización masiva por sucursal (RF-28 + RF-69) ----------
drop function public.bulk_update_prices(numeric, text, uuid, boolean, numeric);
CREATE OR REPLACE FUNCTION public.bulk_update_prices(p_percent numeric, p_scope text DEFAULT 'all'::text, p_scope_id uuid DEFAULT NULL::uuid, p_apply boolean DEFAULT false, p_round_to numeric DEFAULT 100, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(batch_id uuid, presentation_id uuid, product_id uuid, product_name text, presentation_name text, old_price numeric, new_price numeric, sold_by_weight boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_batch uuid;
  v_factor numeric;
  v_count integer;
  v_kg_round numeric;
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
  if p_branch_id is not null and not exists (select 1 from public.branches where id = p_branch_id and archived_at is null) then
    raise exception 'La sucursal no existe o está archivada.' using errcode = 'P0002';
  end if;
  if p_round_to is not null and p_round_to <= 0 then
    raise exception 'El redondeo tiene que ser mayor que cero.' using errcode = '22023';
  end if;

  v_factor := 1 + p_percent / 100;
  -- Balanza (ADR-001): el precio se guarda por gramo y se redondea el precio POR KILO, a múltiplo
  -- de $10 como mínimo, así el precio por gramo queda exacto con dos decimales.
  v_kg_round := case when p_round_to is null then 10 else greatest(10, ceil(p_round_to / 10) * 10) end;

  drop table if exists _price_changes;
  create temp table _price_changes on commit drop as
  select
    pp.id as presentation_id,
    pr.id as product_id,
    pr.name as product_name,
    pp.name as presentation_name,
    coalesce(bp.sale_price, pp.sale_price) as old_price,
    case
      when pp.sold_by_weight then
        greatest(v_kg_round, round(coalesce(bp.sale_price, pp.sale_price) * 1000 * v_factor / v_kg_round) * v_kg_round) / 1000
      when p_round_to is null then round(coalesce(bp.sale_price, pp.sale_price) * v_factor, 2)
      else greatest(p_round_to, round(coalesce(bp.sale_price, pp.sale_price) * v_factor / p_round_to) * p_round_to)
    end as new_price,
    pp.sold_by_weight
  from public.product_presentations pp
  join public.products pr on pr.id = pp.product_id
  left join public.branch_prices bp on bp.presentation_id = pp.id and bp.branch_id = p_branch_id
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
    insert into public.price_update_batches (created_by, percent, scope, scope_id, round_to, changed_count, branch_id)
    values (auth.uid(), p_percent, p_scope, p_scope_id, p_round_to, v_count, p_branch_id)
    returning id into v_batch;

    -- El trigger del historial lee este ajuste para etiquetar cada fila con el lote.
    perform set_config('alverde.price_batch', v_batch::text, true);

    if p_branch_id is null then
      -- Precio base: no toca los precios propios de cada sucursal (RF-69).
      update public.product_presentations pp
         set sale_price = c.new_price,
             updated_at = now()
        from _price_changes c
       where pp.id = c.presentation_id;
    else
      insert into public.branch_prices (branch_id, presentation_id, sale_price, updated_by)
      select p_branch_id, c.presentation_id, c.new_price, auth.uid() from _price_changes c
      -- por nombre de restricción: presentation_id también es columna de salida de la función
      on conflict on constraint branch_prices_pkey do update
        set sale_price = excluded.sale_price, updated_by = excluded.updated_by, updated_at = now();
    end if;

    perform set_config('alverde.price_batch', '', true);
  end if;

  return query
  select v_batch, c.presentation_id, c.product_id, c.product_name, c.presentation_name, c.old_price, c.new_price, c.sold_by_weight
  from _price_changes c
  order by c.product_name, c.presentation_name;
end;
$function$;

revoke execute on function public.bulk_update_prices(numeric, text, uuid, boolean, numeric, uuid) from anon, public;
grant execute on function public.bulk_update_prices(numeric, text, uuid, boolean, numeric, uuid) to authenticated;
