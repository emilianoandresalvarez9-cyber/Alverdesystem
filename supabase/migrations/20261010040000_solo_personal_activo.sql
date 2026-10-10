-- Seguridad: sólo el personal ACTIVO lee datos del negocio y opera.
--
-- Defecto (encontrado en la revisión de seguridad del 10/10/2026):
--   * Muchas políticas RLS pedían sólo `auth.uid() is not null`, o sea «cualquier cuenta con sesión».
--     Un empleado dado de baja (`profiles.active = false`) seguía leyendo clientes (nombre, teléfono,
--     tope y deuda), proveedores, sucursales y cajas, y podía crear y modificar clientes.
--   * Las vistas `customer_accounts` y `employee_catalog` son SECURITY DEFINER (saltean RLS) y no
--     filtraban por nada: cualquier cuenta con sesión veía todos los saldos de fiado.
--   * `process_offline_sale` sólo pedía sesión: una cuenta inactiva registraba ventas, descontaba
--     stock y le cargaba fiado a cualquier cliente. `customer_movements`, lo mismo para leer.
--   * Además, `handle_new_auth_user` le da perfil de empleado activo a TODA cuenta nueva de Supabase
--     Auth. Si el registro abierto está prendido en el proyecto, cualquiera que abra el sitio (la URL
--     y la clave pública están en el JavaScript) puede crearse una cuenta y hacer todo lo anterior.
--     Eso se cierra en el panel de Supabase; esta migración hace que, al menos, dar de baja corte
--     el acceso de verdad.
--   * Dos políticas de administración (faltantes, avisos de stock) miraban el rol sin mirar `active`.
--
-- Regla nueva, la misma que ya usaban apply_offline_operation y los RPC de stock: personal activo
-- = `current_app_role() is not null` (perfil con rol y `active = true`). El perfil propio se sigue
-- pudiendo leer, para que la app sepa que la cuenta está inactiva y la saque.
--
-- No edita migraciones anteriores: reemplaza políticas, vistas y funciones.

-- ---------- 1. Un solo criterio: personal activo ----------
create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() is not null
$$;
revoke execute on function public.is_active_staff() from public, anon;
grant execute on function public.is_active_staff() to authenticated, service_role;

comment on function public.is_active_staff() is
  'true si quien llama tiene perfil activo con rol (empleado o administración). Base de las políticas de lectura y escritura del personal.';

-- ---------- 2. Lecturas de referencia: sucursales, cajas, catálogo, proveedores ----------
drop policy if exists "staff read branch prices" on public.branch_prices;
create policy "personal activo lee precios por sucursal" on public.branch_prices
  for select to authenticated using ((select public.is_active_staff()));

drop policy if exists "staff read branches" on public.branches;
create policy "personal activo lee sucursales" on public.branches
  for select to authenticated using ((select public.is_active_staff()));

drop policy if exists "staff read brands" on public.brands;
create policy "personal activo lee marcas" on public.brands
  for select to authenticated using ((select public.is_active_staff()));

drop policy if exists "staff read categories" on public.categories;
create policy "personal activo lee rubros" on public.categories
  for select to authenticated using ((select public.is_active_staff()));

drop policy if exists "staff read labels" on public.labels;
create policy "personal activo lee etiquetas" on public.labels
  for select to authenticated using ((select public.is_active_staff()));

drop policy if exists "staff read registers" on public.registers;
create policy "personal activo lee cajas" on public.registers
  for select to authenticated using ((select public.is_active_staff()));

drop policy if exists "staff read suppliers" on public.suppliers;
create policy "personal activo lee proveedores" on public.suppliers
  for select to authenticated using ((select public.is_active_staff()));

-- ---------- 3. Clientes: había dos juegos de políticas permisivas duplicadas ----------
-- Las políticas permisivas se suman con OR: hay que borrar TODAS las viejas, si no la que quede
-- sigue abriendo la puerta. El tope y el archivado siguen protegidos por guard_customer_admin_fields.
drop policy if exists "Empleados pueden crear clientes" on public.customers;
drop policy if exists "staff create customers" on public.customers;
drop policy if exists "Empleados pueden ver clientes" on public.customers;
drop policy if exists "staff read customers" on public.customers;
drop policy if exists "Empleados pueden actualizar clientes" on public.customers;

create policy "personal activo lee clientes" on public.customers
  for select to authenticated using ((select public.is_active_staff()));
create policy "personal activo crea clientes" on public.customers
  for insert to authenticated with check ((select public.is_active_staff()));
create policy "personal activo actualiza clientes" on public.customers
  for update to authenticated
  using ((select public.is_active_staff()))
  with check ((select public.is_active_staff()));

-- ---------- 4. Faltantes y avisos de stock ----------
drop policy if exists "Autenticados pueden ver faltantes" on public.missing_items;
drop policy if exists "Autenticados pueden reportar faltantes" on public.missing_items;
drop policy if exists "Solo admins pueden resolver faltantes" on public.missing_items;
create policy "personal activo lee faltantes" on public.missing_items
  for select to authenticated using ((select public.is_active_staff()));
create policy "personal activo reporta faltantes" on public.missing_items
  for insert to authenticated
  with check (reported_by = (select auth.uid()) and (select public.is_active_staff()));
create policy "administracion activa resuelve faltantes" on public.missing_items
  for update to authenticated
  using ((select public.is_administrator()))
  with check ((select public.is_administrator()));

drop policy if exists "Admins read stock warnings" on public.stock_warnings;
create policy "administracion activa lee avisos de stock" on public.stock_warnings
  for select to authenticated using ((select public.is_administrator()));

-- ---------- 5. Registros propios (turnos, ventas, fiado, movimientos): sólo si sigue activo ----------
drop policy if exists "Empleados pueden abrir turno" on public.cash_shifts;
drop policy if exists "Empleados pueden ver sus turnos" on public.cash_shifts;
drop policy if exists "Cajero modifica su turno abierto" on public.cash_shifts;
create policy "personal activo abre su turno" on public.cash_shifts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_staff()));
create policy "personal activo ve sus turnos" on public.cash_shifts
  for select to authenticated
  using ((user_id = (select auth.uid()) and (select public.is_active_staff())) or (select public.is_administrator()));
create policy "personal activo modifica su turno abierto" on public.cash_shifts
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'open' and (select public.is_active_staff()))
  with check (user_id = (select auth.uid()) and (select public.is_active_staff()));

drop policy if exists "Empleados ven sus ventas" on public.sales;
drop policy if exists "staff read own sales" on public.sales;
create policy "personal activo ve sus ventas" on public.sales
  for select to authenticated
  using ((user_id = (select auth.uid()) and (select public.is_active_staff())) or (select public.is_administrator()));

drop policy if exists "Lectura de ítems de venta" on public.sale_items;
drop policy if exists "staff read own sale items" on public.sale_items;
create policy "personal activo ve los items de sus ventas" on public.sale_items
  for select to authenticated
  using (exists (
    select 1 from public.sales s
    where s.id = sale_items.sale_id
      and ((s.user_id = (select auth.uid()) and (select public.is_active_staff())) or (select public.is_administrator()))
  ));

drop policy if exists "staff read credit movements" on public.credit_movements;
create policy "personal activo ve sus movimientos de fiado" on public.credit_movements
  for select to authenticated
  using ((user_id = (select auth.uid()) and (select public.is_active_staff())) or (select public.is_administrator()));

drop policy if exists "staff read offline receipts" on public.offline_operations;
create policy "personal activo ve sus operaciones sin conexion" on public.offline_operations
  for select to authenticated
  using ((received_by = (select auth.uid()) and (select public.is_active_staff())) or (select public.is_administrator()));

drop policy if exists "staff read own stock movements" on public.stock_movements;
create policy "personal activo ve sus movimientos de stock" on public.stock_movements
  for select to authenticated
  using ((user_id = (select auth.uid()) and (select public.is_active_staff())) or (select public.is_administrator()));

-- ---------- 6. Vistas SECURITY DEFINER: filtran ellas mismas, porque saltean RLS ----------
create or replace view public.customer_accounts
with (security_invoker = false, security_barrier = true)
as
select
  c.id,
  c.name,
  c.phone,
  c.credit_limit,
  c.active,
  coalesce(sum(public.credit_movement_delta(m.kind, m.amount, m.adjustment_sign)), 0)::numeric(14, 2) as balance,
  max(m.occurred_at) as last_movement_at
from public.customers c
left join public.credit_movements m on m.customer_id = c.id
where public.current_app_role() is not null
group by c.id;

revoke all on public.customer_accounts from public, anon, authenticated;
grant select on public.customer_accounts to authenticated;

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
    AND public.current_app_role() IS NOT NULL
  GROUP BY p.id, b.id, c.id, pr.id;

revoke all on public.employee_catalog from public, anon, authenticated;
grant select on public.employee_catalog to authenticated;

-- ---------- 7. Historial de una cuenta de fiado ----------
create or replace function public.customer_movements(p_customer_id uuid)
returns table (
  id uuid, kind public.credit_movement_kind, amount numeric, delta numeric,
  note text, sale_id uuid, occurred_at timestamptz, user_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.kind, m.amount, public.credit_movement_delta(m.kind, m.amount, m.adjustment_sign),
         m.note, m.sale_id, m.occurred_at, p.display_name
  from public.credit_movements m
  left join public.profiles p on p.id = m.user_id
  where m.customer_id = p_customer_id and public.current_app_role() is not null
  order by m.occurred_at desc
  limit 200
$$;

revoke execute on function public.customer_movements(uuid) from anon, public;
grant execute on function public.customer_movements(uuid) to authenticated;

-- ---------- 8. Venta: el mismo control que apply_offline_operation ----------
-- Si una venta hecha sin conexión llega después de dar de baja a quien la cobró, se rechaza con
-- 42501 y queda en la cola del equipo (no se descarta): la administración decide si reactiva la
-- cuenta un momento para que sincronice.
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
  if public.current_app_role() is null then
    raise exception 'La cuenta no está activa: no puede registrar ventas.' using errcode = '42501';
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

revoke execute on function public.process_offline_sale(jsonb) from anon, public;
grant execute on function public.process_offline_sale(jsonb) to authenticated;
