-- RF-60: el historial de modificaciones se tiene que poder buscar y filtrar por producto,
-- por persona y por fecha, y mostrar qué cambió con el valor anterior y el nuevo.
-- Hasta ahora la pantalla listaba los últimos 100 sin filtros y mostraba el id de la
-- entidad en vez de su nombre.

create index if not exists audit_history_occurred_idx on public.audit_history (occurred_at desc);
create index if not exists audit_history_user_idx on public.audit_history (user_id, occurred_at desc);

create or replace function public.audit_history_search(
  p_text text default null,
  p_entity text default null,
  p_user_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 200
)
returns table (
  id bigint,
  occurred_at timestamptz,
  entity text,
  entity_id uuid,
  entity_label text,
  field text,
  old_value jsonb,
  new_value jsonb,
  user_id uuid,
  user_name text
)
language sql
security definer
set search_path = public
stable
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
