-- RF-38: los casos de stock negativo (dos cajas vendieron el mismo último lote sin
-- conexión, o una venta sin lotes cargados) quedaban en stock_warnings sin que nadie
-- pudiera verlos ni cerrarlos. Ahora la administradora los lista, los revisa y los marca
-- como resueltos con una nota.

alter table public.stock_warnings
  add column resolved_at timestamptz,
  add column resolved_by uuid references public.profiles(id),
  add column resolution text;

create index stock_warnings_pending_idx on public.stock_warnings (created_at desc)
  where resolved_at is null;

-- Lista para revisión: cada aviso con producto, presentación, lote, venta y quién vendió.
create or replace function public.stock_warnings_for_review(p_include_resolved boolean default false)
returns table (
  id uuid,
  created_at timestamptz,
  message text,
  lot_id uuid,
  product_name text,
  presentation_name text,
  lot_current_quantity numeric,
  sale_id uuid,
  sale_occurred_at timestamptz,
  sale_total numeric,
  register_name text,
  sold_by text,
  resolved_at timestamptz,
  resolved_by_name text,
  resolution text
)
language sql
security definer
set search_path = public
stable
as $$
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
    w.resolution
  from public.stock_warnings w
  left join public.stock_lots sl on sl.id = w.lot_id
  left join public.product_presentations pp on pp.id = sl.presentation_id
  left join public.products pr on pr.id = pp.product_id
  left join public.sales s on s.id = w.sale_id
  left join public.registers r on r.id = s.register_id
  left join public.profiles seller on seller.id = s.user_id
  left join public.profiles resolver on resolver.id = w.resolved_by
  where public.is_administrator()
    and (p_include_resolved or w.resolved_at is null)
  order by (w.resolved_at is null) desc, w.created_at desc;
$$;

revoke execute on function public.stock_warnings_for_review(boolean) from anon, public;
grant execute on function public.stock_warnings_for_review(boolean) to authenticated;

create or replace function public.resolve_stock_warning(p_warning_id uuid, p_resolution text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_administrator() then
    raise exception 'Solo la administradora revisa los casos de stock negativo.' using errcode = '42501';
  end if;
  if p_resolution is null or char_length(trim(p_resolution)) = 0 then
    raise exception 'Escribí qué se hizo con este caso (por ejemplo: "stock ajustado tras conteo").' using errcode = '22023';
  end if;

  update public.stock_warnings
     set resolved_at = now(),
         resolved_by = auth.uid(),
         resolution = trim(p_resolution)
   where id = p_warning_id
     and resolved_at is null;

  if not found then
    raise exception 'El caso no existe o ya estaba resuelto.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.resolve_stock_warning(uuid, text) from anon, public;
grant execute on function public.resolve_stock_warning(uuid, text) to authenticated;
