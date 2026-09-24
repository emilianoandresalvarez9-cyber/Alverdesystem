-- T-11: Anular una venta devuelve el stock
-- Creamos un trigger AFTER UPDATE ON sales para que, cuando pase a voided,
-- devuelva las cantidades a los lotes exactos.

create or replace function public.sale_void_return_stock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_movement record;
begin
  -- Solo accionar si la venta se est anulando
  if old.status = 'closed' and new.status = 'voided' then
    -- Buscamos los movimientos de stock negativos generados por esta venta
    for v_movement in
      select * from public.stock_movements 
      where kind = 'sale' 
      and reason = 'Venta ' || new.local_id
    loop
      -- Devolver el stock al lote original (que haba restado)
      -- v_movement.quantity es negativo (ej. -5), restarlo equivale a sumar (+5).
      update public.stock_lots
      set current_quantity = current_quantity - v_movement.quantity
      where id = v_movement.lot_id;

      -- Registrar el movimiento de cancelacin positivo
      insert into public.stock_movements(
        local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at
      )
      values (
        gen_random_uuid(), 
        'receipt', -- El tipo de movimiento (o adjustment)
        v_movement.product_id, 
        v_movement.lot_id, 
        -v_movement.quantity, -- Negar el negativo para que quede positivo
        'Anulacin de venta ' || new.local_id,
        auth.uid(),
        now()
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists sales_void_return_stock on public.sales;
create trigger sales_void_return_stock
  after update on public.sales
  for each row execute function public.sale_void_return_stock();
