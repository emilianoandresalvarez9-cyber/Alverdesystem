-- ==============================================================================
-- Alverde · Presentaciones "Balanza" (ADR-001 aceptada; RF-11, RF-22, RF-27, RF-33)
-- Regla: una presentación que se vende pesando es "por gramo" (o mililitro):
--   base_quantity = 1, sale_price = precio por gramo, lotes en gramos, venta en gramos.
-- La dueña ve y carga precio por kilo; el sistema lo guarda por gramo.
-- Tests: supabase/tests/balanza_granel_test.sql
-- ==============================================================================

-- 1. Ordenar lo que marcó el relleno por nombre de 20260923110000.
--    Si una presentación marcada no es por gramo: se convierte solo si todavía no tiene stock
--    ni ventas (no hay datos que reinterpretar); si ya tiene, se desmarca y se avisa.
do $$
declare
  r record;
begin
  for r in
    select pr.id, pr.name, pr.base_quantity, p.base_unit,
           exists (select 1 from public.stock_lots sl where sl.presentation_id = pr.id)
             or exists (select 1 from public.sale_items si where si.presentation_id = pr.id) as has_data
    from public.product_presentations pr
    join public.products p on p.id = pr.product_id
    where pr.sold_by_weight and (pr.base_quantity <> 1 or p.base_unit not in ('gram', 'millilitre'))
  loop
    if r.base_unit in ('gram', 'millilitre') and not r.has_data then
      update public.product_presentations
      set sale_price = round(sale_price / base_quantity, 2), base_quantity = 1
      where id = r.id;
    else
      update public.product_presentations set sold_by_weight = false where id = r.id;
      raise notice 'Presentación "%" (%) desmarcada de Balanza: revisar a mano (ADR-001).', r.name, r.id;
    end if;
  end loop;
end $$;

alter table public.product_presentations
  drop constraint if exists product_presentations_scale_per_gram;
alter table public.product_presentations
  add constraint product_presentations_scale_per_gram
  check (not sold_by_weight or base_quantity = 1);

-- 2. Solo se pesa lo que se mide en gramos o mililitros.
create or replace function public.guard_scale_presentation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sold_by_weight and not exists (
    select 1 from public.products p where p.id = new.product_id and p.base_unit in ('gram', 'millilitre')
  ) then
    raise exception 'Solo los productos en gramos o mililitros se venden con balanza.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists product_presentations_guard_scale on public.product_presentations;
create trigger product_presentations_guard_scale
  before insert or update of sold_by_weight, product_id on public.product_presentations
  for each row execute function public.guard_scale_presentation();

-- 3. RPC para la pantalla de Administración: marca/desmarca Balanza y fija el precio por kilo.
-- Una presentación de tamaño fijo (base_quantity <> 1, por ejemplo "250 g") solo se convierte
-- a Balanza con p_convert = true: la pantalla muestra la advertencia y pide confirmación.
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

  update public.product_presentations
  set sold_by_weight = true, base_quantity = 1, sale_price = v_new_price
  where id = p_presentation_id;

  -- RF-27: historial de precios.
  if v_new_price is distinct from v_pr.sale_price or v_pr.base_quantity <> 1 then
    insert into public.product_price_history (presentation_id, sale_price, changed_by)
    values (p_presentation_id, v_new_price, auth.uid());
  end if;
end;
$$;

revoke execute on function public.set_presentation_scale(uuid, boolean, numeric, boolean) from anon, public;
grant execute on function public.set_presentation_scale(uuid, boolean, numeric, boolean) to authenticated;
