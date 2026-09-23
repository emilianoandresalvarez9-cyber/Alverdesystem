-- ==============================================================================
-- Alverde · Endurecimiento de seguridad (QA P1, P2, P3, P4, P6, P7, P9)
-- Migración incremental: no modifica migraciones anteriores.
-- Cada bloque tiene su test en supabase/tests/seguridad_rls_test.sql.
-- ==============================================================================

-- P1 · Supabase concede a `anon` todo objeto nuevo en public. employee_catalog se recreó
-- en 20260923001000 con security_invoker = false y quedó legible sin login.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;
grant select on public.employee_catalog, public.employee_stock_lots to authenticated;

-- Que los objetos que se creen en el futuro no vuelvan a quedar expuestos.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges revoke execute on functions from public;

-- P9 · Funciones sin search_path fijo (log_audit_change es security definer).
alter function public.log_audit_change() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.check_single_open_lot_per_product() set search_path = public;

-- Rol de sesión "de API": las reglas de negocio aplican a usuarios de la app, no a
-- migraciones, seed ni al SQL Editor (postgres / service_role).
create or replace function public.is_api_role()
returns boolean
language sql
stable
set search_path = public
as $$
  select current_user in ('authenticated', 'anon')
$$;

-- P4 · Tope de fiado y archivado de clientes: solo administradora (RF-47).
create or replace function public.guard_customer_admin_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_api_role() or public.is_administrator() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.credit_limit is not null or new.active is distinct from true then
      raise exception 'Solo la administradora define el tope de fiado o archiva clientes (RF-47).'
        using errcode = '42501';
    end if;
  elsif new.credit_limit is distinct from old.credit_limit or new.active is distinct from old.active then
    raise exception 'Solo la administradora define el tope de fiado o archiva clientes (RF-47).'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists customers_guard_admin_fields on public.customers;
create trigger customers_guard_admin_fields
  before insert or update on public.customers
  for each row execute function public.guard_customer_admin_fields();

drop policy if exists "Empleados pueden actualizar clientes" on public.customers;
create policy "Empleados pueden actualizar clientes" on public.customers
  for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- P2 · Nadie podía insertar stock_movements (no había política de INSERT): fallaban
-- ajustes, ingreso rápido y fraccionamiento. Se habilita solo para administradora y a su nombre.
drop policy if exists "Administradora registra movimientos de stock" on public.stock_movements;
create policy "Administradora registra movimientos de stock" on public.stock_movements
  for insert to authenticated
  with check (public.is_administrator() and user_id = auth.uid());

-- P6 · Ventas: solo por RPC (atómica, idempotente, con FEFO). Sin INSERT directo.
drop policy if exists "Empleados registran sus ventas" on public.sales;
drop policy if exists "Inserción de ítems de venta" on public.sale_items;

-- RF-37 · Una venta no se edita; la administradora solo puede anularla.
create or replace function public.guard_sale_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_api_role() then
    return new;
  end if;
  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'Las ventas no se editan (RF-37). Solo se pueden anular.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (old.status = 'closed' and new.status = 'voided') then
    raise exception 'Una venta solo puede pasar de cerrada a anulada.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists sales_guard_immutability on public.sales;
create trigger sales_guard_immutability
  before update on public.sales
  for each row execute function public.guard_sale_immutability();

-- P7 · Turnos: el cajero solo modifica su turno ABIERTO; un turno cerrado es definitivo
-- salvo para la administradora.
drop policy if exists "Empleados pueden cerrar su turno" on public.cash_shifts;
create policy "Cajero modifica su turno abierto" on public.cash_shifts
  for update to authenticated
  using (user_id = auth.uid() and status = 'open')
  with check (user_id = auth.uid());
drop policy if exists "Administradora gestiona turnos" on public.cash_shifts;
create policy "Administradora gestiona turnos" on public.cash_shifts
  for update to authenticated
  using (public.is_administrator())
  with check (public.is_administrator());

-- Un solo turno abierto por caja: los totales por medio de pago (RF-32) salen por turno.
create unique index if not exists cash_shifts_one_open_per_register
  on public.cash_shifts(register_id) where status = 'open';

-- P3 · apply_offline_operation: el empleado podía perdonar deudas (RF-48), registrar
-- movimientos de stock arbitrarios y crear ventas sin FEFO por este camino.
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
  v_credit_kind public.credit_movement_kind;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_kind = 'sale' then
    raise exception 'Las ventas se registran con process_offline_sale.' using errcode = '22023';
  end if;

  if v_kind = 'stock_movement' and not public.is_administrator() then
    raise exception 'Solo la administradora registra movimientos de stock.' using errcode = '42501';
  end if;

  if v_kind = 'credit_movement' then
    v_credit_kind := (v_payload ->> 'movementKind')::public.credit_movement_kind;
    if v_credit_kind = 'adjustment' and not public.is_administrator() then
      raise exception 'Solo la administradora ajusta o perdona deudas (RF-48).' using errcode = '42501';
    end if;
  end if;

  insert into public.offline_operations(local_id, device_id, kind, payload, occurred_at, received_by)
  values (v_local_id, v_device_id, v_kind, v_payload, v_occurred_at, auth.uid())
  on conflict (device_id, local_id) do nothing;

  if not found then
    return true;
  end if;

  if v_kind = 'stock_movement' then
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
      v_credit_kind,
      (v_payload ->> 'amount')::numeric,
      v_payload ->> 'note',
      auth.uid(),
      v_occurred_at
    );
  end if;

  return true;
end;
$$;

revoke execute on function public.apply_offline_operation(jsonb) from anon, public;
grant execute on function public.apply_offline_operation(jsonb) to authenticated;
revoke execute on function public.process_offline_sale(jsonb) from anon, public;
grant execute on function public.process_offline_sale(jsonb) to authenticated;
