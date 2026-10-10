-- RF-38 / RF-65 / RF-66: límite de faltante y aislamiento de cajas por sucursal.
-- El stock negativo máximo es 10 unidades de la presentación en cada sucursal.
-- Se conservan los lotes separados para trazabilidad y vencimientos; el control suma todos
-- los lotes de la misma presentación/sucursal antes de aceptar que el saldo baje.

create or replace function public.guard_stock_lot_negative_floor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other_quantity numeric;
  v_before_quantity numeric;
  v_after_quantity numeric;
begin
  -- Serializa toda mutación de stock de la presentación en la sucursal, incluso cuando el
  -- último lote todavía es positivo. Así dos ventas concurrentes no pueden superar juntas el límite.
  perform pg_advisory_xact_lock(hashtextextended(
    'stock-floor:' || new.branch_id::text || ':' || new.presentation_id::text, 0
  ));

  if tg_op = 'UPDATE' then
    select coalesce(sum(sl.current_quantity), 0)
      into v_other_quantity
    from public.stock_lots sl
    where sl.branch_id = new.branch_id
      and sl.presentation_id = new.presentation_id
      and sl.id <> old.id;
    v_before_quantity := v_other_quantity + old.current_quantity;
  else
    select coalesce(sum(sl.current_quantity), 0)
      into v_other_quantity
    from public.stock_lots sl
    where sl.branch_id = new.branch_id
      and sl.presentation_id = new.presentation_id;
    v_before_quantity := v_other_quantity;
  end if;

  v_after_quantity := v_other_quantity + new.current_quantity;
  if v_after_quantity < -10
     and v_after_quantity < v_before_quantity then
    raise exception 'La venta superaría el faltante máximo de 10 unidades para esta presentación en la sucursal.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_stock_lot_negative_floor() from public, anon, authenticated;

drop trigger if exists stock_lots_negative_floor on public.stock_lots;
create trigger stock_lots_negative_floor
  before insert or update of current_quantity on public.stock_lots
  for each row execute function public.guard_stock_lot_negative_floor();

comment on function public.guard_stock_lot_negative_floor() is
  'RF-38: limita el stock neto por presentación y sucursal a -10; serializa las mutaciones para evitar sobreventa concurrente.';


-- La nueva política de lectura de cajas oculta sucursales ajenas. El trigger necesita leer el
-- nombre de esa caja para devolver un error útil; lo hace como definer, validando el JWT activo.
create or replace function public.guard_cash_shift_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_register_branch uuid;
  v_register_branch_name text;
  v_register_name text;
begin
  if auth.uid() is null or not public.is_active_staff() or public.is_administrator() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.register_id is not distinct from old.register_id then
    return new;
  end if;

  select r.branch_id, b.name, r.name
    into v_register_branch, v_register_branch_name, v_register_name
  from public.registers r
  join public.branches b on b.id = r.branch_id
  where r.id = new.register_id;

  if v_register_branch is distinct from public.current_branch_id() then
    raise exception '% es de la sucursal %, y tu usuario trabaja en otra. Usá una caja de tu sucursal o pedile a administración que te asigne a %.',
      coalesce(v_register_name, 'La caja'), coalesce(v_register_branch_name, '(desconocida)'), coalesce(v_register_branch_name, 'esa sucursal')
      using errcode = '42501';
  end if;
  return new;
end;
$function$;
revoke all on function public.guard_cash_shift_branch() from public, anon, authenticated;
comment on function public.guard_cash_shift_branch() is
  'RF-66: valida la sucursal del turno y obtiene el nombre de cajas ajenas sin exponerlas mediante RLS.';

-- RLS también limita la lectura de cajas, no alcanza con que la interfaz filtre la lista.
drop policy if exists "personal activo lee cajas" on public.registers;
drop policy if exists "personal activo lee cajas de su sucursal" on public.registers;
create policy "personal activo lee cajas de su sucursal"
  on public.registers for select to authenticated
  using (
    public.is_active_staff()
    and (public.is_administrator() or branch_id = public.current_branch_id())
  );

-- Un turno propio que quedó abierto en una sucursal anterior no habilita acceso a esa caja.
drop policy if exists "personal activo ve sus turnos" on public.cash_shifts;
drop policy if exists "personal activo ve turnos de su sucursal" on public.cash_shifts;
create policy "personal activo ve turnos de su sucursal"
  on public.cash_shifts for select to authenticated
  using (
    public.is_active_staff()
    and (
      public.is_administrator()
      or (
        user_id = (select auth.uid())
        and exists (
          select 1
          from public.registers r
          where r.id = cash_shifts.register_id
            and r.branch_id = public.current_branch_id()
        )
      )
    )
  );

-- Defensa de servidor: una venta sincronizada con un turno viejo tampoco puede operar en otra sucursal.
create or replace function public.guard_sale_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and public.is_active_staff()
     and not public.is_administrator()
     and new.branch_id is distinct from public.current_branch_id() then
    raise exception 'La venta corresponde a una caja de otra sucursal. Pedile a administración que revise el turno.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_sale_branch() from public, anon, authenticated;
drop trigger if exists sales_branch_guard on public.sales;
create trigger sales_branch_guard
  before insert or update of branch_id on public.sales
  for each row execute function public.guard_sale_branch();

comment on function public.guard_sale_branch() is
  'RF-66: bloquea ventas del personal activo en una sucursal distinta a la asignada, incluso al sincronizar turnos antiguos.';
