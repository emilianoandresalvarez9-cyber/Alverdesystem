-- RF-59 / RF-60: altas y bajas de personal desde Administración, con control y con historial.
--
-- Desde 20261010040000, dar de baja (profiles.active = false) corta el acceso de verdad. Hasta ahora
-- sólo se podía hacer con SQL. Ahora hay botones en Administración → Sucursales → Personal, y la
-- base aplica dos reglas, para que un error de un clic no deje el local sin poder administrarse:
--   * nadie se da de baja a sí mismo (lo hace otra persona de administración);
--   * siempre queda al menos una persona de administración activa (no se la da de baja ni se le
--     quita el rol a la última).
-- Las reglas valen desde la app (la API). Desde el SQL Editor, el dueño puede corregir lo que sea.
-- Cada cambio de acceso, rol o sucursal de un usuario queda en el historial (quién, cuándo, antes y
-- después), y Trazabilidad lo muestra con el nombre de la persona.
--
-- Se puede correr más de una vez (create or replace / drop if exists).

create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
security invoker -- is_api_role() mira current_user: en SECURITY DEFINER sería el dueño
set search_path = public
as $$
begin
  if not public.is_api_role() then
    return new;
  end if;
  if old.active and not new.active and new.id = auth.uid() then
    raise exception 'No podés darte de baja a vos misma: pedíselo a otra persona de administración.'
      using errcode = '42501';
  end if;
  if old.role = 'administrator' and old.active
     and (not new.active or new.role is distinct from 'administrator')
     and not exists (
       select 1 from public.profiles p
       where p.role = 'administrator' and p.active and p.id <> old.id
     ) then
    raise exception 'Tiene que quedar al menos una persona de administración activa.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_profile_changes() from public, anon, authenticated;

comment on function public.guard_profile_changes() is
  'RF-59: desde la app nadie se da de baja a sí mismo y siempre queda al menos una persona de administración activa.';

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- Historial (RF-60): acceso, rol y sucursal de cada usuario.
drop trigger if exists audit_profiles_access on public.profiles;
create trigger audit_profiles_access
  after update on public.profiles
  for each row
  when (
    old.active is distinct from new.active
    or old.role is distinct from new.role
    or old.branch_id is distinct from new.branch_id
  )
  execute function public.log_audit_change();

-- Trazabilidad: el usuario se muestra con su nombre. Mismo cuerpo que en 20261010050000 más «profiles».
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
        when 'profiles' then (select p.display_name from public.profiles p where p.id = h.entity_id)
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
