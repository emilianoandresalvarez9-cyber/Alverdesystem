-- El trigger trg_log_price_history ya registra cambios de sale_price.
-- La RPC solo modifica la presentación; no debe volver a insertar el mismo evento.
create or replace function public.set_presentation_scale(
  p_presentation_id uuid,
  p_sold_by_weight boolean,
  p_price_per_kg numeric default null,
  p_convert boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pr record;
  v_new_price numeric(14, 2);
begin
  if not public.is_administrator() then
    raise exception 'Solo la administradora configura la balanza.' using errcode = '42501';
  end if;

  select pr.id, pr.base_quantity, pr.sale_price, p.base_unit,
         exists (select 1 from public.stock_lots sl where sl.presentation_id = pr.id)
           or exists (select 1 from public.sale_items si where si.presentation_id = pr.id) as has_data
    into v_pr
  from public.product_presentations pr
  join public.products p on p.id = pr.product_id
  where pr.id = p_presentation_id
  for update of pr;

  if not found then
    raise exception 'Presentación inexistente.' using errcode = 'P0002';
  end if;

  if not p_sold_by_weight then
    update public.product_presentations set sold_by_weight = false where id = p_presentation_id;
    return;
  end if;

  if v_pr.base_unit not in ('gram', 'millilitre') then
    raise exception 'Solo los productos en gramos o mililitros se venden con balanza.' using errcode = '23514';
  end if;
  if v_pr.base_quantity <> 1 and v_pr.has_data then
    raise exception 'Esta presentación ya tiene stock o ventas en otra unidad. Creá una presentación nueva "granel" y marcala con Balanza.'
      using errcode = '22023';
  end if;
  if v_pr.base_quantity <> 1 and not p_convert then
    raise exception 'Esta presentación es de % fijos (por ejemplo, una bolsita). Convertirla en venta por peso cambia lo que es: confirmá la conversión.', v_pr.base_quantity
      using errcode = '22023';
  end if;
  if p_price_per_kg is null or p_price_per_kg <= 0 then
    raise exception 'Indicá el precio por kilo.' using errcode = '22023';
  end if;
  -- Precio por gramo con 2 decimales: es exacto si el precio por kilo es múltiplo de 10.
  if (p_price_per_kg * 100) % 1000 <> 0 then
    raise exception 'El precio por kilo tiene que ser múltiplo de $10 (por ejemplo, $3.150 y no $3.155).' using errcode = '22023';
  end if;

  v_new_price := p_price_per_kg / 1000;

  -- trg_log_price_history registra una sola entrada si cambia sale_price.
  update public.product_presentations
  set sold_by_weight = true, base_quantity = 1, sale_price = v_new_price
  where id = p_presentation_id;
end;
$$;

revoke execute on function public.set_presentation_scale(uuid, boolean, numeric, boolean) from anon, public;
grant execute on function public.set_presentation_scale(uuid, boolean, numeric, boolean) to authenticated;
