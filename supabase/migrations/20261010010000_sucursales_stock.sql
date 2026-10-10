-- RF-65 a RF-67, RF-70: varias sucursales, cada una con su stock.
--
-- Hasta ahora los lotes no tenían sucursal: una venta descontaba del lote que vencía primero
-- en cualquier local. Desde acá:
--   * cada lote, movimiento y faltante pertenece a una sucursal;
--   * la venta descuenta solo lotes de la sucursal de su caja (o de la del usuario si no hay turno);
--   * ingreso, ajuste, apertura y fraccionamiento trabajan en una sucursal; el empleado solo en la suya;
--   * la regla de una sola bolsa de granel abierta (RF-12) es por sucursal;
--   * el lote no cambia de sucursal por UPDATE: eso es un traspaso (RF-68, migración aparte).
-- El stock existente pasa a la sucursal más antigua (si no hay ninguna sucursal, se crea "Casa central").

-- ---------- 1. Sucursal de trabajo ----------
create or replace function public.default_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.branches where archived_at is null order by created_at, id limit 1;
$$;

-- Sucursal del usuario actual: la asignada en su perfil (si está activa) o la principal.
create or replace function public.current_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select b.id from public.profiles p join public.branches b on b.id = p.branch_id and b.archived_at is null
      where p.id = auth.uid()),
    public.default_branch_id()
  );
$$;

-- Sucursal en la que se opera: el administrador puede pedir cualquiera activa; el empleado
-- solo la suya (RF-66). Sin sucursales cargadas no se puede operar stock.
create or replace function public.resolve_work_branch(p_branch_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_branch uuid;
begin
  if public.is_administrator() then
    v_branch := coalesce(p_branch_id, public.current_branch_id());
  else
    v_branch := public.current_branch_id();
    if p_branch_id is not null and p_branch_id is distinct from v_branch then
      raise exception 'Solo podés operar en tu sucursal.' using errcode = '42501';
    end if;
  end if;
  if v_branch is null or not exists (select 1 from public.branches where id = v_branch and archived_at is null) then
    raise exception 'No hay una sucursal activa para operar. Cargá una en Administración → Sucursales.' using errcode = 'P0002';
  end if;
  return v_branch;
end;
$$;

-- El empleado solo toca lotes de su sucursal; el administrador, cualquiera.
create or replace function public.assert_lot_branch_access(p_lot_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_administrator() then
    return;
  end if;
  if exists (select 1 from public.stock_lots where id = p_lot_id and branch_id is distinct from public.current_branch_id()) then
    raise exception 'Ese lote es de otra sucursal.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.default_branch_id() from anon, public;
revoke execute on function public.current_branch_id() from anon, public;
revoke execute on function public.resolve_work_branch(uuid) from anon, public;
revoke execute on function public.assert_lot_branch_access(uuid) from anon, public;
grant execute on function public.default_branch_id() to authenticated;
grant execute on function public.current_branch_id() to authenticated;
grant execute on function public.resolve_work_branch(uuid) to authenticated;
grant execute on function public.assert_lot_branch_access(uuid) to authenticated;

-- ---------- 2. Lotes por sucursal (RF-65) ----------
-- RF-53: el concepto de sucursal existe desde el día uno. Si todavía no se cargó ninguna,
-- se crea la principal para que el stock (existente o nuevo) tenga dónde estar.
do $$
begin
  if public.default_branch_id() is null then
    insert into public.branches (name) values ('Casa central');
  end if;
end;
$$;

alter table public.stock_lots add column branch_id uuid references public.branches(id);
update public.stock_lots set branch_id = public.default_branch_id() where branch_id is null;
alter table public.stock_lots alter column branch_id set not null;
create index stock_lots_branch_presentation_idx on public.stock_lots (branch_id, presentation_id, status);

create or replace function public.stock_lots_branch_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.branch_id is null then
      new.branch_id := public.current_branch_id();
    end if;
    if new.branch_id is null then
      raise exception 'No hay ninguna sucursal cargada para registrar el lote.' using errcode = 'P0002';
    end if;
  elsif new.branch_id is distinct from old.branch_id then
    raise exception 'Un lote no cambia de sucursal: usá un traspaso (RF-68).' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.stock_lots_branch_guard() from anon, public;

-- El nombre empieza con 00 para correr antes que trg_stock_lots_single_open (orden alfabético).
create trigger trg_stock_lots_00_branch
  before insert or update of branch_id on public.stock_lots
  for each row execute function public.stock_lots_branch_guard();

-- ---------- 3. Movimientos y faltantes con sucursal (RF-70) ----------
alter table public.stock_movements add column branch_id uuid references public.branches(id);
update public.stock_movements m set branch_id = sl.branch_id from public.stock_lots sl where sl.id = m.lot_id;
create index stock_movements_branch_idx on public.stock_movements (branch_id, occurred_at desc);

create or replace function public.stock_movements_fill_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null and new.lot_id is not null then
    select branch_id into new.branch_id from public.stock_lots where id = new.lot_id;
  end if;
  if new.branch_id is null then
    new.branch_id := public.current_branch_id();
  end if;
  return new;
end;
$$;
revoke all on function public.stock_movements_fill_branch() from anon, public;
create trigger trg_stock_movements_branch
  before insert on public.stock_movements
  for each row execute function public.stock_movements_fill_branch();

alter table public.missing_items add column branch_id uuid references public.branches(id);
update public.missing_items set branch_id = public.default_branch_id() where branch_id is null;
create index missing_items_branch_idx on public.missing_items (branch_id, resolved);

create or replace function public.missing_items_fill_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null then
    new.branch_id := public.current_branch_id();
  end if;
  return new;
end;
$$;
revoke all on function public.missing_items_fill_branch() from anon, public;
create trigger trg_missing_items_branch
  before insert on public.missing_items
  for each row execute function public.missing_items_fill_branch();

-- ---------- 4. Una bolsa de granel abierta por producto y por sucursal (RF-12, RF-65) ----------
CREATE OR REPLACE FUNCTION public.check_single_open_lot_per_product()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_product_id uuid;
  v_conflict_lot_id uuid;
BEGIN
  IF NEW.opened_at IS NULL OR NEW.status <> 'open' OR COALESCE(NEW.current_quantity, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT pp.product_id
    INTO v_product_id
  FROM public.product_presentations pp
  WHERE pp.id = NEW.presentation_id
    AND pp.sold_by_weight;

  -- RF-12 concerns the source bag sold by weight. Fractioned presentations
  -- sold by package are independent inventory, as specified by RF-13.
  IF v_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent attempts to open two bulk lots for the same product.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_product_id::text || ':' || NEW.branch_id::text, 0));

  SELECT sl.id
    INTO v_conflict_lot_id
  FROM public.stock_lots sl
  JOIN public.product_presentations pp ON pp.id = sl.presentation_id
  WHERE pp.product_id = v_product_id
    AND pp.sold_by_weight
    AND sl.id <> NEW.id
    AND sl.branch_id = NEW.branch_id
    AND sl.opened_at IS NOT NULL
    AND sl.status = 'open'
    AND sl.current_quantity > 0
  LIMIT 1;

  IF v_conflict_lot_id IS NOT NULL THEN
    RAISE EXCEPTION 'Regla de oro del granel: Ya existe una bolsa abierta activa para este producto (Lote: %). No se puede abrir una segunda bolsa mientras la anterior siga activa (RF-11, RF-12).', v_conflict_lot_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------- 5. Venta: FEFO y stock negativo dentro de la sucursal (RF-09, RF-38, RF-65) ----------
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

    select sale_price into v_catalog_price from public.product_presentations where id = v_presentation_id;
    if found and v_item_price < (v_catalog_price * 0.5) then
      raise exception 'Precio offline sospechoso. Venta rechazada.' using errcode = '22023';
    end if;

    if found and abs(v_catalog_price - v_item_price) >= 0.01 then
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

-- ---------- 6. Ajuste, apertura y fraccionamiento: el empleado, solo en su sucursal ----------
CREATE OR REPLACE FUNCTION public.adjust_stock(p_lot_id uuid, p_product_id uuid, p_kind stock_movement_kind, p_quantity numeric, p_reason text, p_new_lot_quantity numeric, p_should_close_lot boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.app_role := public.current_app_role();
  v_product_id uuid;
  v_current_quantity numeric(14,3);
  v_status public.stock_lot_status;
  v_new_quantity numeric(14,3);
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL OR v_role NOT IN ('administrator', 'employee') THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('waste', 'discard', 'adjustment') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido para un ajuste.' USING ERRCODE = '22023';
  END IF;
  IF p_quantity IS NULL OR p_quantity::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_quantity = 0 OR p_quantity <> round(p_quantity, 3) THEN
    RAISE EXCEPTION 'La cantidad debe ser distinta de cero y tener hasta tres decimales.' USING ERRCODE = '22023';
  END IF;
  IF p_kind IN ('waste', 'discard') AND p_quantity > 0 THEN
    RAISE EXCEPTION 'Merma y descarte solo pueden quitar stock.' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) = 0 OR char_length(trim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'El motivo es obligatorio y no puede superar 500 caracteres.' USING ERRCODE = '22023';
  END IF;

  SELECT pr.product_id, sl.current_quantity, sl.status
    INTO v_product_id, v_current_quantity, v_status
  FROM public.stock_lots sl
  JOIN public.product_presentations pr ON pr.id = sl.presentation_id
  WHERE sl.id = p_lot_id
  FOR UPDATE OF sl;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote no encontrado.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.assert_lot_branch_access(p_lot_id);
  IF p_product_id IS DISTINCT FROM v_product_id THEN
    RAISE EXCEPTION 'El producto no corresponde al lote indicado.' USING ERRCODE = '22023';
  END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'No se puede ajustar un lote cerrado.' USING ERRCODE = '22023';
  END IF;

  v_new_quantity := v_current_quantity + p_quantity;
  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'La cantidad a quitar supera el stock disponible.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.stock_movements (
    local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
  ) VALUES (
    gen_random_uuid(), p_kind, v_product_id, p_lot_id, p_quantity,
    trim(p_reason), v_user_id, now()
  );

  UPDATE public.stock_lots
  SET current_quantity = v_new_quantity,
      status = CASE WHEN v_new_quantity = 0 THEN 'closed'::public.stock_lot_status ELSE 'open'::public.stock_lot_status END
  WHERE id = p_lot_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.open_stock_lot(p_lot_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role := public.current_app_role();
  v_status public.stock_lot_status;
  v_opened_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_role IS NULL OR v_role NOT IN ('administrator', 'employee') THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT sl.status, sl.opened_at
    INTO v_status, v_opened_at
  FROM public.stock_lots sl
  WHERE sl.id = p_lot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote no encontrado.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.assert_lot_branch_access(p_lot_id);
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'No se puede abrir un lote cerrado.' USING ERRCODE = '22023';
  END IF;
  IF v_opened_at IS NULL THEN
    UPDATE public.stock_lots SET opened_at = now() WHERE id = p_lot_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fraction_stock(p_origin_lot_id uuid, p_target_presentation_id uuid, p_packets_num numeric, p_grams_needed numeric, p_merma numeric, p_new_origin_quantity numeric, p_origin_lot_status stock_lot_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.app_role := public.current_app_role();
  v_origin_product_id uuid;
  v_origin_supplier_id uuid;
  v_origin_cost numeric;
  v_origin_base_quantity numeric;
  v_origin_sold_by_weight boolean;
  v_origin_received_at timestamptz;
  v_origin_expiry date;
  v_origin_opened_at timestamptz;
  v_origin_quantity numeric(14,3);
  v_origin_status public.stock_lot_status;
  v_origin_branch_id uuid;
  v_target_product_id uuid;
  v_target_base_quantity numeric;
  v_target_sold_by_weight boolean;
  v_target_cost numeric;
  v_target_lot_id uuid;
  v_grams_needed numeric(14,3);
  v_theoretical_remaining numeric(14,3);
  v_real_remaining numeric(14,3);
  v_merma numeric(14,3);
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL OR v_role NOT IN ('administrator', 'employee') THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_packets_num IS NULL OR p_packets_num::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_packets_num <= 0 OR p_packets_num <> trunc(p_packets_num) THEN
    RAISE EXCEPTION 'La cantidad de paquetes debe ser un entero mayor que cero.' USING ERRCODE = '22023';
  END IF;
  IF p_grams_needed::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_merma::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_new_origin_quantity::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Las cantidades del fraccionamiento deben ser finitas.' USING ERRCODE = '22023';
  END IF;
  IF p_origin_lot_status IS NULL THEN
    RAISE EXCEPTION 'Debe indicar si la bolsa de origen queda abierta o terminada.' USING ERRCODE = '22023';
  END IF;

  SELECT pp.product_id, sl.supplier_id, sl.purchase_cost, pp.base_quantity,
         pp.sold_by_weight, sl.received_at, sl.manufacturer_expiry_date,
         coalesce(sl.opened_at, now()), sl.current_quantity, sl.status, sl.branch_id
    INTO v_origin_product_id, v_origin_supplier_id, v_origin_cost,
         v_origin_base_quantity, v_origin_sold_by_weight, v_origin_received_at,
         v_origin_expiry, v_origin_opened_at, v_origin_quantity, v_origin_status, v_origin_branch_id
  FROM public.stock_lots sl
  JOIN public.product_presentations pp ON pp.id = sl.presentation_id
  WHERE sl.id = p_origin_lot_id
  FOR UPDATE OF sl;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote origen no encontrado.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.assert_lot_branch_access(p_origin_lot_id);
  IF v_origin_status <> 'open' OR v_origin_quantity <= 0 OR NOT v_origin_sold_by_weight THEN
    RAISE EXCEPTION 'El lote de origen debe ser un lote de granel abierto con stock disponible.' USING ERRCODE = '22023';
  END IF;

  SELECT pp.product_id, pp.base_quantity, pp.sold_by_weight
    INTO v_target_product_id, v_target_base_quantity, v_target_sold_by_weight
  FROM public.product_presentations pp
  JOIN public.products p ON p.id = pp.product_id
  WHERE pp.id = p_target_presentation_id AND pp.active AND p.active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presentación destino inexistente o inactiva.' USING ERRCODE = 'P0002';
  END IF;
  IF v_target_product_id IS DISTINCT FROM v_origin_product_id THEN
    RAISE EXCEPTION 'El destino debe ser otra presentación del mismo producto.' USING ERRCODE = '22023';
  END IF;
  IF v_target_sold_by_weight THEN
    RAISE EXCEPTION 'La presentación destino debe venderse por unidad.' USING ERRCODE = '22023';
  END IF;

  v_grams_needed := round(p_packets_num * v_target_base_quantity, 3);
  IF p_grams_needed IS DISTINCT FROM v_grams_needed THEN
    RAISE EXCEPTION 'La cantidad a descontar no coincide con el peso de las presentaciones generadas.' USING ERRCODE = '22023';
  END IF;
  v_theoretical_remaining := round(v_origin_quantity - v_grams_needed, 3);
  IF v_theoretical_remaining < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente en el lote de origen.' USING ERRCODE = '22023';
  END IF;
  IF p_origin_lot_status = 'open' AND v_theoretical_remaining = 0 THEN
    RAISE EXCEPTION 'Si no queda remanente, debe marcar la bolsa como terminada.' USING ERRCODE = '22023';
  END IF;

  IF p_origin_lot_status = 'open' THEN
    v_real_remaining := v_theoretical_remaining;
    v_merma := 0;
  ELSE
    v_real_remaining := p_new_origin_quantity;
    IF v_real_remaining IS NULL OR v_real_remaining < 0 OR v_real_remaining > v_theoretical_remaining THEN
      RAISE EXCEPTION 'El remanente real debe estar entre cero y el remanente teórico.' USING ERRCODE = '22023';
    END IF;
    v_merma := round(v_theoretical_remaining - v_real_remaining, 3);
  END IF;

  IF p_new_origin_quantity IS DISTINCT FROM v_real_remaining OR p_merma IS DISTINCT FROM v_merma THEN
    RAISE EXCEPTION 'El remanente o la merma no coinciden con los valores calculados.' USING ERRCODE = '22023';
  END IF;

  v_target_cost := round(
    (v_origin_cost / CASE WHEN v_origin_sold_by_weight THEN 1 ELSE v_origin_base_quantity END)
    * CASE WHEN v_target_sold_by_weight THEN 1 ELSE v_target_base_quantity END,
    2
  );

  INSERT INTO public.stock_movements (
    local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
  ) VALUES (
    gen_random_uuid(), 'portioning', v_origin_product_id, p_origin_lot_id,
    -v_grams_needed, 'Fraccionamiento: ' || p_packets_num || ' unidades', v_user_id, now()
  );

  IF v_merma > 0 THEN
    INSERT INTO public.stock_movements (
      local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
    ) VALUES (
      gen_random_uuid(), 'waste', v_origin_product_id, p_origin_lot_id, -v_merma,
      'Merma por cierre de bolsa en fraccionamiento', v_user_id, now()
    );
  END IF;

  INSERT INTO public.stock_lots (
    presentation_id, supplier_id, initial_quantity, current_quantity, purchase_cost,
    received_at, manufacturer_expiry_date, opened_at, portioned_at, status, branch_id
  ) VALUES (
    p_target_presentation_id, v_origin_supplier_id, p_packets_num, p_packets_num,
    v_target_cost, v_origin_received_at, v_origin_expiry, now(), now(), 'open', v_origin_branch_id
  ) RETURNING id INTO v_target_lot_id;

  INSERT INTO public.stock_movements (
    local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
  ) VALUES (
    gen_random_uuid(), 'portioning', v_origin_product_id, v_target_lot_id, p_packets_num,
    'Alta por fraccionamiento desde lote origen', v_user_id, now()
  );

  UPDATE public.stock_lots
  SET current_quantity = v_real_remaining,
      status = p_origin_lot_status,
      opened_at = v_origin_opened_at
  WHERE id = p_origin_lot_id;
END;
$function$;

-- ---------- 7. Ingreso de mercadería en una sucursal (RF-51, RF-65) ----------
drop function public.quick_restock(uuid, uuid, numeric, date, numeric);
CREATE OR REPLACE FUNCTION public.quick_restock(p_presentation_id uuid, p_product_id uuid, p_quantity numeric, p_expiry_date date, p_purchase_cost numeric DEFAULT NULL::numeric, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.app_role := public.current_app_role();
  v_product_id uuid;
  v_base_quantity numeric;
  v_sold_by_weight boolean;
  v_supplier_id uuid;
  v_cost_per_base_unit numeric;
  v_lot_unit_cost numeric;
  v_lot_id uuid;
  v_branch_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL OR v_role NOT IN ('administrator', 'employee') THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_quantity IS NULL OR p_quantity::text IN ('NaN', 'Infinity', '-Infinity') OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero.' USING ERRCODE = '22023';
  END IF;
  IF p_purchase_cost IS NOT NULL AND p_purchase_cost < 0 THEN
    RAISE EXCEPTION 'El costo no puede ser negativo.' USING ERRCODE = '22023';
  END IF;
  IF p_purchase_cost IS NOT NULL AND v_role <> 'administrator' THEN
    RAISE EXCEPTION 'Solo la administradora puede indicar un costo manual.' USING ERRCODE = '42501';
  END IF;

  v_branch_id := public.resolve_work_branch(p_branch_id);

  SELECT pr.product_id, pr.base_quantity, pr.sold_by_weight
    INTO v_product_id, v_base_quantity, v_sold_by_weight
  FROM public.product_presentations pr
  JOIN public.products p ON p.id = pr.product_id
  WHERE pr.id = p_presentation_id AND pr.active AND p.active
  FOR SHARE OF pr, p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto o presentación inexistente o inactivo.' USING ERRCODE = 'P0002';
  END IF;
  IF p_product_id IS DISTINCT FROM v_product_id THEN
    RAISE EXCEPTION 'La presentación no pertenece al producto indicado.' USING ERRCODE = '22023';
  END IF;

  SELECT sp.supplier_id,
         CASE WHEN sp.purchase_quantity > 0 THEN sp.cost / sp.purchase_quantity END
    INTO v_supplier_id, v_cost_per_base_unit
  FROM public.supplier_products sp
  JOIN public.suppliers s ON s.id = sp.supplier_id AND s.active
  WHERE sp.product_id = v_product_id AND sp.is_primary
  ORDER BY sp.last_purchase_at DESC NULLS LAST, sp.supplier_id
  LIMIT 1
  FOR SHARE OF sp;

  IF p_purchase_cost IS NOT NULL THEN
    v_lot_unit_cost := p_purchase_cost;
  ELSIF v_cost_per_base_unit IS NOT NULL THEN
    v_lot_unit_cost := round(
      v_cost_per_base_unit * CASE WHEN v_sold_by_weight THEN 1 ELSE v_base_quantity END,
      2
    );
  ELSE
    v_lot_unit_cost := 0;
  END IF;

  INSERT INTO public.stock_lots (
    presentation_id, supplier_id, initial_quantity, current_quantity,
    purchase_cost, status, manufacturer_expiry_date, received_at, branch_id
  ) VALUES (
    p_presentation_id, v_supplier_id, p_quantity, p_quantity,
    v_lot_unit_cost, 'open', p_expiry_date, now(), v_branch_id
  ) RETURNING id INTO v_lot_id;

  INSERT INTO public.stock_movements (
    local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
  ) VALUES (
    gen_random_uuid(), 'receipt', v_product_id, v_lot_id, p_quantity,
    'Ingreso rápido de mercadería (RF-51)', v_user_id, now()
  );

  RETURN v_lot_id;
END;
$function$;

revoke execute on function public.quick_restock(uuid, uuid, numeric, date, numeric, uuid) from anon, public;
grant execute on function public.quick_restock(uuid, uuid, numeric, date, numeric, uuid) to authenticated, service_role;

-- ---------- 8. Cola sin conexión: ingreso y faltantes llevan la sucursal ----------
CREATE OR REPLACE FUNCTION public.apply_offline_operation(p_operation jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.app_role := public.current_app_role();
  v_local_id uuid := (p_operation ->> 'localId')::uuid;
  v_device_id uuid := (p_operation ->> 'deviceId')::uuid;
  v_kind public.offline_operation_kind := (p_operation ->> 'kind')::public.offline_operation_kind;
  v_occurred_at timestamptz := coalesce((p_operation ->> 'createdAt')::timestamptz, now());
  v_payload jsonb := p_operation -> 'payload';
  v_action text := v_payload ->> 'action';
  v_credit_kind public.credit_movement_kind;
  v_movement_kind public.stock_movement_kind;
  v_sign smallint;
  v_product_id uuid;
  v_branch_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL OR v_role NOT IN ('administrator', 'employee') THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_local_id IS NULL OR v_device_id IS NULL OR v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object' THEN
    RAISE EXCEPTION 'La operación offline no tiene identificadores o datos válidos.' USING ERRCODE = '22023';
  END IF;
  IF v_kind = 'sale' THEN
    RAISE EXCEPTION 'Las ventas se registran con process_offline_sale.' USING ERRCODE = '22023';
  END IF;

  IF v_kind = 'stock_movement' THEN
    IF coalesce(nullif(v_payload ->> 'userId', '')::uuid, v_user_id) <> v_user_id THEN
      RAISE EXCEPTION 'La operación de stock pertenece a otro usuario.' USING ERRCODE = '42501';
    END IF;
  ELSIF v_kind = 'credit_movement' THEN
    v_credit_kind := (v_payload ->> 'movementKind')::public.credit_movement_kind;
    IF v_credit_kind = 'adjustment' THEN
      IF v_role <> 'administrator' THEN
        RAISE EXCEPTION 'Solo la administradora ajusta o perdona deudas (RF-48).' USING ERRCODE = '42501';
      END IF;
      v_sign := coalesce(nullif(v_payload ->> 'adjustmentSign', '')::smallint, -1);
    END IF;
  ELSIF v_kind = 'missing_item' THEN
    v_product_id := nullif(v_payload ->> 'productId', '')::uuid;
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'El aviso de faltante necesita productId.' USING ERRCODE = '22023';
    END IF;
  ELSIF v_kind NOT IN ('credit_movement', 'missing_item') THEN
    RAISE EXCEPTION 'Tipo de operación offline no admitido.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.offline_operations(local_id, device_id, kind, payload, occurred_at, received_by)
  VALUES (v_local_id, v_device_id, v_kind, v_payload, v_occurred_at, v_user_id)
  ON CONFLICT (device_id, local_id) DO NOTHING;

  -- A retry after a committed response loss is an acknowledged no-op. All
  -- stock writes below share the transaction with this idempotency record.
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF v_kind = 'stock_movement' THEN
    IF v_action = 'quick_restock' THEN
      PERFORM public.quick_restock(
        nullif(v_payload ->> 'presentationId', '')::uuid,
        nullif(v_payload ->> 'productId', '')::uuid,
        (v_payload ->> 'quantity')::numeric,
        nullif(v_payload ->> 'expiryDate', '')::date,
        NULL,
        nullif(v_payload ->> 'branchId', '')::uuid
      );
    ELSIF v_action = 'open_lot' THEN
      PERFORM public.open_stock_lot(nullif(v_payload ->> 'lotId', '')::uuid);
    ELSIF v_action = 'adjust_stock' THEN
      PERFORM public.adjust_stock(
        nullif(v_payload ->> 'lotId', '')::uuid,
        nullif(v_payload ->> 'productId', '')::uuid,
        (v_payload ->> 'movementKind')::public.stock_movement_kind,
        (v_payload ->> 'quantity')::numeric,
        v_payload ->> 'reason',
        NULL,
        false
      );
    ELSIF v_action = 'fraction_stock' THEN
      PERFORM public.fraction_stock(
        nullif(v_payload ->> 'originLotId', '')::uuid,
        nullif(v_payload ->> 'targetPresentationId', '')::uuid,
        (v_payload ->> 'packetsNum')::numeric,
        (v_payload ->> 'gramsNeeded')::numeric,
        (v_payload ->> 'merma')::numeric,
        (v_payload ->> 'newOriginQuantity')::numeric,
        (v_payload ->> 'originLotStatus')::public.stock_lot_status
      );
    ELSIF v_action IS NULL THEN
      -- Compatibility for old queued adjustments that predate the action field.
      v_movement_kind := (v_payload ->> 'movementKind')::public.stock_movement_kind;
      IF v_movement_kind NOT IN ('waste', 'discard', 'adjustment') THEN
        RAISE EXCEPTION 'Movimiento offline legado no admitido.' USING ERRCODE = '22023';
      END IF;
      PERFORM public.adjust_stock(
        nullif(v_payload ->> 'lotId', '')::uuid,
        nullif(v_payload ->> 'productId', '')::uuid,
        v_movement_kind,
        (v_payload ->> 'quantity')::numeric,
        v_payload ->> 'reason',
        NULL,
        false
      );
    ELSE
      RAISE EXCEPTION 'Acción de stock offline desconocida.' USING ERRCODE = '22023';
    END IF;
  ELSIF v_kind = 'credit_movement' THEN
    INSERT INTO public.credit_movements(local_id, customer_id, sale_id, kind, amount, adjustment_sign, note, user_id, occurred_at)
    VALUES (
      v_local_id,
      (v_payload ->> 'customerId')::uuid,
      nullif(v_payload ->> 'saleId', '')::uuid,
      v_credit_kind,
      (v_payload ->> 'amount')::numeric,
      v_sign,
      v_payload ->> 'note',
      v_user_id,
      v_occurred_at
    );
  ELSIF v_kind = 'missing_item' THEN
    -- Repeated reports of the same still-open item remain one actionable task.
    -- RF-70: el faltante es de una sucursal; uno abierto por producto y sucursal.
    v_branch_id := public.resolve_work_branch(nullif(v_payload ->> 'branchId', '')::uuid);
    IF NOT EXISTS (SELECT 1 FROM public.missing_items WHERE product_id = v_product_id AND branch_id = v_branch_id AND NOT resolved) THEN
      INSERT INTO public.missing_items(product_id, reported_by, note, created_at, branch_id)
      VALUES (v_product_id, v_user_id, nullif(v_payload ->> 'note', ''), v_occurred_at, v_branch_id);
    END IF;
  END IF;

  RETURN true;
END;
$function$;


-- ---------- 9. Vista de stock del empleado: solo su sucursal; columnas de sucursal al final ----------
create or replace view public.employee_stock_lots
with (security_invoker = false, security_barrier = true)
as
 SELECT sl.id,
    sl.presentation_id,
    sl.supplier_id,
    sl.initial_quantity,
    sl.current_quantity,
    sl.received_at,
    sl.manufacturer_expiry_date,
    sl.opened_at,
    sl.portioned_at,
    sl.status,
    effective_expiry_date(sl.manufacturer_expiry_date, sl.opened_at, p.open_shelf_life_days) AS effective_expiry_date,
    p.id AS product_id,
    p.name AS product_name,
    p.base_unit,
    p.open_shelf_life_days,
    pr.name AS presentation_name,
    pr.base_quantity,
    pr.sold_by_weight,
    s.name AS supplier_name,
    sl.created_at,
    sl.branch_id,
    b.name AS branch_name
   FROM stock_lots sl
     JOIN product_presentations pr ON pr.id = sl.presentation_id
     JOIN products p ON p.id = pr.product_id
     JOIN branches b ON b.id = sl.branch_id
     LEFT JOIN suppliers s ON s.id = sl.supplier_id
  WHERE current_app_role() IS NOT NULL
    AND (is_administrator() OR sl.branch_id = current_branch_id());

revoke all on public.employee_stock_lots from public, anon;
grant select on public.employee_stock_lots to authenticated;
comment on view public.employee_stock_lots is
  'Restricted employee stock projection (no purchase_cost). Employees see only their branch (RF-65/66); administrators see every branch with branch_name.';

-- ---------- 10. Revisión de stock negativo por sucursal (RF-38, RF-70) ----------
drop function public.stock_warnings_for_review(boolean);
CREATE OR REPLACE FUNCTION public.stock_warnings_for_review(p_include_resolved boolean DEFAULT false, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, message text, lot_id uuid, product_name text, presentation_name text, lot_current_quantity numeric, sale_id uuid, sale_occurred_at timestamp with time zone, sale_total numeric, register_name text, sold_by text, resolved_at timestamp with time zone, resolved_by_name text, resolution text, branch_id uuid, branch_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    w.id,
    w.created_at,
    w.message,
    w.lot_id,
    pr.name,
    pp.name,
    sl.current_quantity,
    w.sale_id,
    s.occurred_at,
    s.total_amount,
    r.name,
    coalesce(seller.display_name, seller.id::text),
    w.resolved_at,
    coalesce(resolver.display_name, resolver.id::text),
    w.resolution,
    coalesce(sl.branch_id, s.branch_id),
    br.name
  from public.stock_warnings w
  left join public.stock_lots sl on sl.id = w.lot_id
  left join public.product_presentations pp on pp.id = sl.presentation_id
  left join public.products pr on pr.id = pp.product_id
  left join public.sales s on s.id = w.sale_id
  left join public.registers r on r.id = s.register_id
  left join public.profiles seller on seller.id = s.user_id
  left join public.profiles resolver on resolver.id = w.resolved_by
  left join public.branches br on br.id = coalesce(sl.branch_id, s.branch_id)
  where public.is_administrator()
    and (p_include_resolved or w.resolved_at is null)
    and (p_branch_id is null or coalesce(sl.branch_id, s.branch_id) = p_branch_id)
  order by (w.resolved_at is null) desc, w.created_at desc;
$function$;

revoke execute on function public.stock_warnings_for_review(boolean, uuid) from anon, public;
grant execute on function public.stock_warnings_for_review(boolean, uuid) to authenticated;
