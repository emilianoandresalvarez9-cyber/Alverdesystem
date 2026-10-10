-- Seguridad: el turno de caja no se puede retocar desde la caja (RF-32).
--
-- Defecto (revisión de seguridad del 10/10/2026): la política «Cajero modifica su turno abierto»
-- dejaba cambiar cualquier columna del turno propio con un PATCH directo a cash_shifts, y el
-- cierre guardaba el efectivo esperado y la hora que mandaba el navegador. Reproducido en la base
-- local, la cajera podía:
--   * bajar el monto inicial (10.000 → 5.000) con la caja abierta: el efectivo esperado baja y la
--     diferencia no aparece en ningún lado;
--   * cerrar con un efectivo esperado inventado y con la hora de cierre corrida;
--   * crear un turno ya cerrado con montos inventados.
-- Nada de eso quedaba en el historial: cash_shifts no tenía trigger de auditoría.
--
-- Arreglo:
--   1. Para quien no es administración, desde la API: el turno nace abierto y sin cierre, con
--      monto inicial no negativo; después, monto inicial, caja, cajera y apertura quedan fijos, y
--      el único cambio permitido es cerrarlo.
--   2. Al cerrar (cajera o administración), la base pone la hora y calcula el efectivo esperado:
--      monto inicial + ventas en efectivo no anuladas del turno. La app ya cierra sólo con todas
--      las ventas enviadas; ahora además muestra el número que guardó la base.
--   3. Las correcciones (de administración, o desde el SQL Editor) quedan en el historial (RF-60):
--      cualquier cambio de monto inicial, caja, cajera o apertura, y todo cambio a un turno cerrado.
--      El cierre normal no ensucia el historial.
--
-- No edita migraciones anteriores.

-- ---------- 1 y 2. Control de altas y cambios ----------
-- SECURITY INVOKER a propósito, como guard_customer_admin_fields: is_api_role() mira current_user,
-- que dentro de una función SECURITY DEFINER sería el dueño y el control no frenaría a nadie.
-- La suma de ventas corre con los permisos de quien cierra: la cajera ve las ventas de su turno
-- (son suyas) y administración ve todas.
create or replace function public.guard_cash_shift()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_restricted boolean := public.is_api_role() and not public.is_administrator();
begin
  if tg_op = 'INSERT' then
    if v_restricted then
      if new.status is distinct from 'open' or new.closed_at is not null or new.final_balance is not null then
        raise exception 'Un turno se abre abierto: el cierre lo registra el sistema.' using errcode = '42501';
      end if;
      if new.initial_balance is null or new.initial_balance < 0 then
        raise exception 'El monto inicial del turno no puede ser negativo.' using errcode = '22023';
      end if;
    end if;
    return new;
  end if;

  if v_restricted then
    if new.id is distinct from old.id
       or new.register_id is distinct from old.register_id
       or new.user_id is distinct from old.user_id
       or new.opened_at is distinct from old.opened_at
       or new.initial_balance is distinct from old.initial_balance
       or new.created_at is distinct from old.created_at then
      raise exception 'El monto inicial, la caja y la apertura de un turno no se cambian. Si hubo un error, lo corrige administración.'
        using errcode = '42501';
    end if;
    if new.status is not distinct from old.status
       and (new.final_balance is distinct from old.final_balance or new.closed_at is distinct from old.closed_at) then
      raise exception 'El efectivo esperado y la hora de cierre los registra el sistema al cerrar el turno.'
        using errcode = '42501';
    end if;
  end if;

  if old.status = 'open' and new.status = 'closed' then
    new.closed_at := now();
    new.final_balance := new.initial_balance + coalesce((
      select sum(s.total_amount)
      from public.sales s
      where s.shift_id = new.id and s.status = 'closed' and s.payment_method = 'cash'
    ), 0);
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_cash_shift() from public, anon, authenticated;

comment on function public.guard_cash_shift() is
  'RF-32: desde la caja, un turno sólo se abre (sin cierre, monto no negativo) y se cierra; monto inicial, caja, cajera y apertura quedan fijos. Al cerrar, la base pone la hora y calcula el efectivo esperado.';

drop trigger if exists cash_shifts_guard on public.cash_shifts;
create trigger cash_shifts_guard
  before insert or update on public.cash_shifts
  for each row execute function public.guard_cash_shift();

-- ---------- 3. Historial de correcciones ----------
drop trigger if exists audit_cash_shift_corrections on public.cash_shifts;
create trigger audit_cash_shift_corrections
  after update on public.cash_shifts
  for each row
  when (
    old.initial_balance is distinct from new.initial_balance
    or old.register_id is distinct from new.register_id
    or old.user_id is distinct from new.user_id
    or old.opened_at is distinct from new.opened_at
    or (old.status = 'closed' and (
      new.status is distinct from old.status
      or new.final_balance is distinct from old.final_balance
      or new.closed_at is distinct from old.closed_at
    ))
  )
  execute function public.log_audit_change();

-- Trazabilidad: el turno se muestra como «Turno Caja 1 · 10/10 09:00» (hora de Argentina).
create or replace function public.audit_history_search(
  p_text text default null,
  p_entity text default null,
  p_user_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 200
)
returns table (
  id bigint, occurred_at timestamptz, entity text, entity_id uuid, entity_label text,
  field text, old_value jsonb, new_value jsonb, user_id uuid, user_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with labeled as (
    select
      h.*,
      case h.entity
        when 'products' then (select p.name from public.products p where p.id = h.entity_id)
        when 'product_presentations' then (
          select p.name || ' · ' || pp.name
          from public.product_presentations pp join public.products p on p.id = pp.product_id
          where pp.id = h.entity_id)
        when 'brands' then (select b.name from public.brands b where b.id = h.entity_id)
        when 'categories' then (select c.name from public.categories c where c.id = h.entity_id)
        when 'labels' then (select l.name from public.labels l where l.id = h.entity_id)
        when 'customers' then (select c.name from public.customers c where c.id = h.entity_id)
        when 'sales' then (select 'Venta ' || to_char(s.occurred_at, 'DD/MM HH24:MI') from public.sales s where s.id = h.entity_id)
        when 'cash_shifts' then (
          select 'Turno ' || r.name || ' · ' || to_char(cs.opened_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI')
          from public.cash_shifts cs join public.registers r on r.id = cs.register_id
          where cs.id = h.entity_id)
        else null
      end as entity_label,
      coalesce(pr.display_name, h.user_id::text) as user_name
    from public.audit_history h
    left join public.profiles pr on pr.id = h.user_id
    where public.is_administrator()
      and (p_entity is null or h.entity = p_entity)
      and (p_user_id is null or h.user_id = p_user_id)
      and (p_from is null or h.occurred_at >= p_from)
      and (p_to is null or h.occurred_at < p_to)
  )
  select id, occurred_at, entity, entity_id, entity_label, field, old_value, new_value, user_id, user_name
  from labeled
  where p_text is null
     or trim(p_text) = ''
     or entity_label ilike '%' || trim(p_text) || '%'
     or field ilike '%' || trim(p_text) || '%'
  order by occurred_at desc, id desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

revoke execute on function public.audit_history_search(text, text, uuid, timestamptz, timestamptz, integer) from anon, public;
grant execute on function public.audit_history_search(text, text, uuid, timestamptz, timestamptz, integer) to authenticated;
