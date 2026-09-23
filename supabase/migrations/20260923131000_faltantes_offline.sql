-- ==============================================================================
-- Alverde · Faltantes desde el celular, con o sin conexión (RF-49). Migración incremental.
-- Antes, sin conexión, la app encolaba un "ajuste de stock" sin cantidad que nunca se podía
-- aplicar: el faltante no llegaba y la operación quedaba trabada en la cola.
-- Tests: supabase/tests/faltantes_offline_test.sql
-- ==============================================================================

create or replace function public.apply_offline_operation(p_operation jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id uuid := (p_operation ->> 'localId')::uuid;
  v_device_id uuid := (p_operation ->> 'deviceId')::uuid;
  v_kind public.offline_operation_kind := (p_operation ->> 'kind')::public.offline_operation_kind;
  v_occurred_at timestamptz := coalesce((p_operation ->> 'createdAt')::timestamptz, now());
  v_payload jsonb := p_operation -> 'payload';
  v_credit_kind public.credit_movement_kind;
  v_sign smallint;
  v_product_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_kind = 'sale' then
    raise exception 'Las ventas se registran con process_offline_sale.' using errcode = '22023';
  end if;

  if v_kind = 'stock_movement' and not public.is_administrator() then
    raise exception 'Solo la administradora registra movimientos de stock.' using errcode = '42501';
  end if;

  if v_kind = 'credit_movement' then
    v_credit_kind := (v_payload ->> 'movementKind')::public.credit_movement_kind;
    if v_credit_kind = 'adjustment' then
      if not public.is_administrator() then
        raise exception 'Solo la administradora ajusta o perdona deudas (RF-48).' using errcode = '42501';
      end if;
      v_sign := coalesce(nullif(v_payload ->> 'adjustmentSign', '')::smallint, -1);
    end if;
  end if;

  if v_kind = 'missing_item' then
    v_product_id := nullif(v_payload ->> 'productId', '')::uuid;
    if v_product_id is null then
      raise exception 'El aviso de faltante necesita productId.' using errcode = '22023';
    end if;
  end if;

  insert into public.offline_operations(local_id, device_id, kind, payload, occurred_at, received_by)
  values (v_local_id, v_device_id, v_kind, v_payload, v_occurred_at, auth.uid())
  on conflict (device_id, local_id) do nothing;

  if not found then
    return true;
  end if;

  if v_kind = 'stock_movement' then
    insert into public.stock_movements(local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at)
    values (
      v_local_id,
      (v_payload ->> 'movementKind')::public.stock_movement_kind,
      (v_payload ->> 'productId')::uuid,
      nullif(v_payload ->> 'lotId', '')::uuid,
      (v_payload ->> 'quantity')::numeric,
      v_payload ->> 'reason',
      auth.uid(),
      v_occurred_at
    );
  elsif v_kind = 'credit_movement' then
    insert into public.credit_movements(local_id, customer_id, sale_id, kind, amount, adjustment_sign, note, user_id, occurred_at)
    values (
      v_local_id,
      (v_payload ->> 'customerId')::uuid,
      nullif(v_payload ->> 'saleId', '')::uuid,
      v_credit_kind,
      (v_payload ->> 'amount')::numeric,
      v_sign,
      v_payload ->> 'note',
      auth.uid(),
      v_occurred_at
    );
  elsif v_kind = 'missing_item' then
    -- Dos avisos del mismo producto mientras nadie repuso son el mismo faltante.
    if not exists (select 1 from public.missing_items where product_id = v_product_id and not resolved) then
      insert into public.missing_items (product_id, reported_by, note, created_at)
      values (v_product_id, auth.uid(), nullif(v_payload ->> 'note', ''), v_occurred_at);
    end if;
  end if;

  return true;
end;
$$;

revoke execute on function public.apply_offline_operation(jsonb) from anon, public;
grant execute on function public.apply_offline_operation(jsonb) to authenticated;
