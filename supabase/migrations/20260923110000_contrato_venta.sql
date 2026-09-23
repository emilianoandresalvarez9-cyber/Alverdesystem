-- ==============================================================================
-- Alverde · Contrato de venta (QA P5; RF-08, RF-09, RF-31, RF-32, RF-33, RF-37, RF-38, RF-46)
-- Migración incremental. Tests: supabase/tests/venta_contrato_test.sql
-- ==============================================================================

-- 1. Presentaciones que se venden por peso (RF-22, RF-33). Hasta ahora no había forma de
--    distinguir "granel por kg" de "bolsita de 150 g": ambas son de base_unit = gram.
alter table public.product_presentations
  add column if not exists sold_by_weight boolean not null default false;

-- Relleno inicial por nombre, según el ejemplo de los requisitos ("granel por kg").
-- La administradora debe revisar el resultado (ver PR y docs/decisiones/ADR-001).
update public.product_presentations
set sold_by_weight = true
where not sold_by_weight and name ilike '%granel%';

drop view if exists public.employee_catalog;
create view public.employee_catalog
with (security_invoker = false)
as
select
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
  pr.sold_by_weight,
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
group by p.id, b.id, c.id, pr.id;

revoke all on public.employee_catalog from anon, public;
grant select on public.employee_catalog to authenticated;

-- 1b. RF-38 · Stock negativo. 20260923021000 intentaba borrar este CHECK buscando el texto
--     'current_quantity >= 0', pero Postgres lo guarda como '(current_quantity >= (0)::numeric)':
--     no coincidía nunca, así que vender más de lo que había hacía fallar la venta entera
--     (y en la cola offline se reintentaba para siempre).
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.stock_lots'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~ 'current_quantity\s*>=\s*\(?0'
  loop
    execute format('alter table public.stock_lots drop constraint %I', r.conname);
  end loop;
end $$;

-- 2. process_offline_sale v2
--    Antes: medio de pago inválido → 'cash' en silencio; total tomado del cliente;
--    fiado sin cargo al cliente; sin movimientos de stock; FEFO por vencimiento de
--    fábrica en vez de vencimiento efectivo; turno sin validar.
create or replace function public.process_offline_sale(payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
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
        insert into public.missing_items (product_id, reported_by, note)
        values (v_product_id, auth.uid(), format('Venta sin lotes cargados. Faltante: %s.', v_remaining));
        insert into public.stock_warnings (sale_id, message)
        values (v_sale_id, format('Venta sin lotes cargados para la presentación %s.', v_presentation_id));
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
$$;

revoke execute on function public.process_offline_sale(jsonb) from anon, public;
grant execute on function public.process_offline_sale(jsonb) to authenticated;

-- 3. RF-32 · Totales de un turno por medio de pago. security invoker: aplica RLS,
--    así el cajero ve su turno y la administradora cualquiera.
create or replace function public.shift_totals(p_shift_id uuid)
returns table (payment_method public.payment_method, sales_count bigint, total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select s.payment_method, count(*), coalesce(sum(s.total_amount), 0)
  from public.sales s
  where s.shift_id = p_shift_id and s.status = 'closed'
  group by s.payment_method
  order by s.payment_method
$$;

revoke execute on function public.shift_totals(uuid) from anon, public;
grant execute on function public.shift_totals(uuid) to authenticated;
