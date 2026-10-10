-- Corrige #82 (RF-28/RF-29): en presentaciones de balanza el precio se guarda POR GRAMO
-- (ADR-001). La actualización masiva redondeaba ese precio por gramo a $100: un granel de
-- $14.800/kg ($14,80 el gramo) con +10 % quedaba en $100 el gramo ($100.000/kg).
-- Ahora se redondea el precio por kilo y las funciones devuelven sold_by_weight para que la
-- pantalla y el Excel de reetiquetado muestren el precio por kilo.

drop function public.bulk_update_prices(numeric, text, uuid, boolean, numeric);
CREATE OR REPLACE FUNCTION public.bulk_update_prices(p_percent numeric, p_scope text DEFAULT 'all'::text, p_scope_id uuid DEFAULT NULL::uuid, p_apply boolean DEFAULT false, p_round_to numeric DEFAULT 100)
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
    pp.sale_price as old_price,
    case
      when pp.sold_by_weight then
        greatest(v_kg_round, round(pp.sale_price * 1000 * v_factor / v_kg_round) * v_kg_round) / 1000
      when p_round_to is null then round(pp.sale_price * v_factor, 2)
      else greatest(p_round_to, round(pp.sale_price * v_factor / p_round_to) * p_round_to)
    end as new_price,
    pp.sold_by_weight
  from public.product_presentations pp
  join public.products pr on pr.id = pp.product_id
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
    insert into public.price_update_batches (created_by, percent, scope, scope_id, round_to, changed_count)
    values (auth.uid(), p_percent, p_scope, p_scope_id, p_round_to, v_count)
    returning id into v_batch;

    -- El trigger del historial lee este ajuste para etiquetar cada fila con el lote.
    perform set_config('alverde.price_batch', v_batch::text, true);

    update public.product_presentations pp
       set sale_price = c.new_price,
           updated_at = now()
      from _price_changes c
     where pp.id = c.presentation_id;

    perform set_config('alverde.price_batch', '', true);
  end if;

  return query
  select v_batch, c.presentation_id, c.product_id, c.product_name, c.presentation_name, c.old_price, c.new_price, c.sold_by_weight
  from _price_changes c
  order by c.product_name, c.presentation_name;
end;
$function$;

revoke execute on function public.bulk_update_prices(numeric, text, uuid, boolean, numeric) from anon, public;
grant execute on function public.bulk_update_prices(numeric, text, uuid, boolean, numeric) to authenticated;

drop function public.price_batch_changes(uuid);
CREATE OR REPLACE FUNCTION public.price_batch_changes(p_batch_id uuid)
 RETURNS TABLE(presentation_id uuid, product_id uuid, product_name text, presentation_name text, internal_barcode text, old_price numeric, new_price numeric, changed_at timestamp with time zone, sold_by_weight boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select h.presentation_id, pr.id, pr.name, pp.name, pp.internal_barcode, h.previous_price, h.sale_price, h.changed_at, pp.sold_by_weight
  from public.product_price_history h
  join public.product_presentations pp on pp.id = h.presentation_id
  join public.products pr on pr.id = pp.product_id
  where h.batch_id = p_batch_id
    and public.is_administrator()
  order by pr.name, pp.name;
$function$;

revoke execute on function public.price_batch_changes(uuid) from anon, public;
grant execute on function public.price_batch_changes(uuid) to authenticated;
