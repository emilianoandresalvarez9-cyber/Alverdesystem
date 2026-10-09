-- RF-03: la administradora puede crear, renombrar, UNIR y archivar marcas, rubros y
-- etiquetas, y asignarlas a productos de a uno o EN BLOQUE. Faltaban unir y asignar en
-- bloque. Ambas operaciones tocan varias filas, así que van por RPC para ser atómicas.

create or replace function public.merge_classifier(p_kind text, p_from_id uuid, p_into_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moved integer := 0;
  v_more integer := 0;
begin
  if not public.is_administrator() then
    raise exception 'Solo la administradora puede unir marcas, rubros o etiquetas.' using errcode = '42501';
  end if;
  if p_kind not in ('brand', 'category', 'label') then
    raise exception 'Tipo inválido: %', p_kind using errcode = '22023';
  end if;
  if p_from_id is null or p_into_id is null or p_from_id = p_into_id then
    raise exception 'Elegí dos elementos distintos para unir.' using errcode = '22023';
  end if;

  if p_kind = 'brand' then
    if not exists (select 1 from public.brands where id = p_into_id and archived_at is null) then
      raise exception 'La marca de destino no existe o está archivada.' using errcode = 'P0002';
    end if;
    if not exists (select 1 from public.brands where id = p_from_id) then
      raise exception 'La marca a unir no existe.' using errcode = 'P0002';
    end if;
    update public.products set brand_id = p_into_id, updated_at = now() where brand_id = p_from_id;
    get diagnostics v_moved = row_count;
    update public.brands set archived_at = now() where id = p_from_id and archived_at is null;

  elsif p_kind = 'category' then
    if not exists (select 1 from public.categories where id = p_into_id and archived_at is null) then
      raise exception 'El rubro de destino no existe o está archivado.' using errcode = 'P0002';
    end if;
    if not exists (select 1 from public.categories where id = p_from_id) then
      raise exception 'El rubro a unir no existe.' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.categories where id = p_into_id and parent_id = p_from_id) then
      raise exception 'No se puede unir un rubro dentro de uno de sus subrubros.' using errcode = '22023';
    end if;
    update public.products set category_id = p_into_id, updated_at = now() where category_id = p_from_id;
    get diagnostics v_moved = row_count;
    -- Los subrubros del rubro unido pasan a colgar del destino.
    update public.categories set parent_id = p_into_id where parent_id = p_from_id and id <> p_into_id;
    -- El multiplicador por rubro del destino manda; el del origen se descarta.
    delete from public.category_price_multipliers where category_id = p_from_id;
    update public.categories set archived_at = now() where id = p_from_id and archived_at is null;

  else
    if not exists (select 1 from public.labels where id = p_into_id and archived_at is null) then
      raise exception 'La etiqueta de destino no existe o está archivada.' using errcode = 'P0002';
    end if;
    if not exists (select 1 from public.labels where id = p_from_id) then
      raise exception 'La etiqueta a unir no existe.' using errcode = 'P0002';
    end if;
    insert into public.product_labels (product_id, label_id)
    select product_id, p_into_id from public.product_labels where label_id = p_from_id
    on conflict do nothing;
    get diagnostics v_moved = row_count;
    delete from public.product_labels where label_id = p_from_id;
    get diagnostics v_more = row_count;
    v_moved := v_more; -- productos que tenían la etiqueta unida (con o sin duplicado)
    update public.labels set archived_at = now() where id = p_from_id and archived_at is null;
  end if;

  return v_moved;
end;
$$;

revoke execute on function public.merge_classifier(text, uuid, uuid) from anon, public;
grant execute on function public.merge_classifier(text, uuid, uuid) to authenticated;

create or replace function public.assign_classifier(
  p_kind text,
  p_id uuid,
  p_product_ids uuid[],
  p_remove boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if not public.is_administrator() then
    raise exception 'Solo la administradora puede asignar marcas, rubros o etiquetas en bloque.' using errcode = '42501';
  end if;
  if p_kind not in ('brand', 'category', 'label') then
    raise exception 'Tipo inválido: %', p_kind using errcode = '22023';
  end if;
  if p_product_ids is null or cardinality(p_product_ids) = 0 then
    raise exception 'Elegí al menos un producto.' using errcode = '22023';
  end if;

  if p_kind = 'brand' then
    if not p_remove and not exists (select 1 from public.brands where id = p_id and archived_at is null) then
      raise exception 'La marca no existe o está archivada.' using errcode = 'P0002';
    end if;
    update public.products set brand_id = case when p_remove then null else p_id end, updated_at = now()
     where id = any(p_product_ids)
       and brand_id is distinct from (case when p_remove then null else p_id end);
    get diagnostics v_count = row_count;

  elsif p_kind = 'category' then
    if not p_remove and not exists (select 1 from public.categories where id = p_id and archived_at is null) then
      raise exception 'El rubro no existe o está archivado.' using errcode = 'P0002';
    end if;
    update public.products set category_id = case when p_remove then null else p_id end, updated_at = now()
     where id = any(p_product_ids)
       and category_id is distinct from (case when p_remove then null else p_id end);
    get diagnostics v_count = row_count;

  else
    if p_remove then
      delete from public.product_labels where label_id = p_id and product_id = any(p_product_ids);
      get diagnostics v_count = row_count;
    else
      if not exists (select 1 from public.labels where id = p_id and archived_at is null) then
        raise exception 'La etiqueta no existe o está archivada.' using errcode = 'P0002';
      end if;
      insert into public.product_labels (product_id, label_id)
      select p.id, p_id from public.products p where p.id = any(p_product_ids)
      on conflict do nothing;
      get diagnostics v_count = row_count;
    end if;
  end if;

  return v_count;
end;
$$;

revoke execute on function public.assign_classifier(text, uuid, uuid[], boolean) from anon, public;
grant execute on function public.assign_classifier(text, uuid, uuid[], boolean) to authenticated;
