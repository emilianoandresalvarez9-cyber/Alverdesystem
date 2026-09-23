-- ==============================================================================
-- Alverde · Clientes y fiado (RF-45 a RF-48). Migración incremental.
-- Tests: supabase/tests/clientes_fiado_test.sql
-- ==============================================================================

-- RF-48 · "Ajustar o perdonar": un ajuste puede subir la deuda (inflación) o bajarla (perdón).
-- amount sigue siendo > 0; el sentido lo da adjustment_sign. Los cargos y abonos no lo usan.
alter table public.credit_movements
  add column if not exists adjustment_sign smallint check (adjustment_sign in (-1, 1));

update public.credit_movements set adjustment_sign = -1
where kind = 'adjustment' and adjustment_sign is null;

alter table public.credit_movements
  drop constraint if exists credit_movements_adjustment_sign_required;
alter table public.credit_movements
  add constraint credit_movements_adjustment_sign_required
  check ((kind = 'adjustment') = (adjustment_sign is not null));

-- RF-46 · El saldo es la suma de los movimientos, nunca un campo que se pisa.
create or replace function public.credit_movement_delta(
  p_kind public.credit_movement_kind, p_amount numeric, p_sign smallint
) returns numeric
language sql
immutable
set search_path = public
as $$
  select case p_kind
    when 'charge' then p_amount
    when 'payment' then -p_amount
    else p_amount * coalesce(p_sign, -1)
  end
$$;

-- Cuentas de clientes con saldo. Los empleados necesitan ver el saldo y el tope para decidir
-- un fiado; no hay costos acá (RNF-04). security_invoker = false porque credit_movements solo
-- deja ver a cada empleado sus propios movimientos.
create or replace view public.customer_accounts
with (security_invoker = false)
as
select
  c.id,
  c.name,
  c.phone,
  c.credit_limit,
  c.active,
  coalesce(sum(public.credit_movement_delta(m.kind, m.amount, m.adjustment_sign)), 0)::numeric(14, 2) as balance,
  max(m.occurred_at) as last_movement_at
from public.customers c
left join public.credit_movements m on m.customer_id = c.id
group by c.id;

revoke all on public.customer_accounts from anon, public;
grant select on public.customer_accounts to authenticated;

-- Historial de una cuenta (lo que el cliente pregunta: "¿de qué es esta deuda?").
create or replace function public.customer_movements(p_customer_id uuid)
returns table (
  id uuid, kind public.credit_movement_kind, amount numeric, delta numeric,
  note text, sale_id uuid, occurred_at timestamptz, user_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.kind, m.amount, public.credit_movement_delta(m.kind, m.amount, m.adjustment_sign),
         m.note, m.sale_id, m.occurred_at, p.display_name
  from public.credit_movements m
  left join public.profiles p on p.id = m.user_id
  where m.customer_id = p_customer_id and auth.uid() is not null
  order by m.occurred_at desc
  limit 200
$$;

revoke execute on function public.customer_movements(uuid) from anon, public;
grant execute on function public.customer_movements(uuid) to authenticated;

-- apply_offline_operation v3: agrega adjustmentSign. Mantiene las reglas de 20260923100000.
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
  end if;

  return true;
end;
$$;

revoke execute on function public.apply_offline_operation(jsonb) from anon, public;
grant execute on function public.apply_offline_operation(jsonb) to authenticated;
