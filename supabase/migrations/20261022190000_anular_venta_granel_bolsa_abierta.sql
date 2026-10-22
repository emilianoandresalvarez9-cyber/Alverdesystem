-- A-05 (RF-12, RF-37): Al anular una venta de granel cuyo lote original quedó vacío y luego se
-- abrió otra bolsa del mismo producto en la sucursal, devolver el stock a la bolsa abierta
-- vigente (y dar por terminada la bolsa vieja vacía) para no chocar con la regla de una sola
-- bolsa abierta (check_single_open_lot_per_product, P0001).

create or replace function public.sale_void_return_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movement record;
  v_target_lot_id uuid;
  v_active_open_lot_id uuid;
  v_lot_branch_id uuid;
  v_lot_product_id uuid;
  v_sold_by_weight boolean;
  v_charged numeric;
  v_reversed numeric;
begin
  if not (old.status = 'closed' and new.status = 'voided') then
    return new;
  end if;

  -- Con security definer, el control de quién anula se hace acá: solo la administradora
  -- (o el servidor, sin usuario). RLS y guard_sale_immutability ya lo limitaban; esto lo refuerza.
  if auth.uid() is not null and not public.is_administrator() then
    raise exception 'Solo la administradora anula ventas.' using errcode = '42501';
  end if;

  -- P15: todos los tramos de la venta, incluido el que quedó en stock negativo (RF-38).
  for v_movement in
    select *
    from public.stock_movements
    where kind = 'sale'
      and reason in ('Venta ' || new.local_id, 'Venta ' || new.local_id || ' (stock negativo)')
  loop
    v_target_lot_id := v_movement.lot_id;
    v_active_open_lot_id := null;

    select sl.branch_id, pp.product_id, pp.sold_by_weight
      into v_lot_branch_id, v_lot_product_id, v_sold_by_weight
    from public.stock_lots sl
    join public.product_presentations pp on pp.id = sl.presentation_id
    where sl.id = v_movement.lot_id;

    if coalesce(v_sold_by_weight, false) then
      select sl.id
        into v_active_open_lot_id
      from public.stock_lots sl
      join public.product_presentations pp on pp.id = sl.presentation_id
      where pp.product_id = v_lot_product_id
        and pp.sold_by_weight
        and sl.branch_id = v_lot_branch_id
        and sl.id <> v_movement.lot_id
        and sl.opened_at is not null
        and sl.status = 'open'
        and sl.current_quantity > 0
      order by sl.opened_at desc, sl.id
      limit 1;

      if v_active_open_lot_id is not null then
        update public.stock_lots
        set status = 'closed'
        where id = v_movement.lot_id
          and current_quantity <= 0
          and status <> 'closed';
        v_target_lot_id := v_active_open_lot_id;
      end if;
    end if;

    update public.stock_lots
    set current_quantity = current_quantity - v_movement.quantity
    where id = v_target_lot_id;

    insert into public.stock_movements (local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at)
    values (
      gen_random_uuid(), 'adjustment', v_movement.product_id, v_target_lot_id,
      -v_movement.quantity, 'Anulación de venta ' || new.local_id,
      coalesce(auth.uid(), v_movement.user_id), now()
    );
  end loop;

  -- P14: revertir el fiado por lo cargado que todavía no se revirtió (idempotente).
  select coalesce(sum(amount), 0) into v_charged
  from public.credit_movements where sale_id = new.id and kind = 'charge';
  select coalesce(sum(amount), 0) into v_reversed
  from public.credit_movements where sale_id = new.id and kind = 'adjustment' and adjustment_sign = -1;

  if v_charged - v_reversed > 0 then
    insert into public.credit_movements (local_id, customer_id, sale_id, kind, amount, adjustment_sign, note, user_id, occurred_at)
    select gen_random_uuid(), customer_id, new.id, 'adjustment', v_charged - v_reversed, -1,
           'Anulación de venta ' || new.local_id, coalesce(auth.uid(), user_id), now()
    from public.credit_movements
    where sale_id = new.id and kind = 'charge'
    order by occurred_at
    limit 1;
  end if;

  return new;
end;
$$;

revoke execute on function public.sale_void_return_stock() from anon, public;
