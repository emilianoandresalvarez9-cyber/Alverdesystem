-- ==============================================================================
-- Alverde · Anular una venta devuelve TODO el stock y revierte el fiado (T-11, RF-37, RF-46)
--
-- Defectos QA de 20260923200000_t11_anular_venta.sql, verificados con datos sobre main 4b551c6:
-- P14: anular una venta fiada no revertía el cargo; la clienta seguía debiendo el total.
-- P15: solo se devolvían los movimientos con motivo exacto 'Venta <id>'. La parte que la venta
--      dejó en stock negativo tiene motivo 'Venta <id> (stock negativo)' y no volvía al lote.
-- Además, la devolución se registraba como 'receipt' (ingreso de mercadería) y se mezclaba con
-- compras en reportes; ahora es 'adjustment' con motivo "Anulación de venta".
-- Migración nueva: no edita la anterior. Tests: supabase/tests/anular_venta_test.sql
-- ==============================================================================

create or replace function public.sale_void_return_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movement record;
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
    update public.stock_lots
    set current_quantity = current_quantity - v_movement.quantity
    where id = v_movement.lot_id;

    insert into public.stock_movements (local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at)
    values (
      gen_random_uuid(), 'adjustment', v_movement.product_id, v_movement.lot_id,
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
