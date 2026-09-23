-- Tests de 20260923120000_clientes_saldos.sql (RF-45 a RF-48).
begin;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'emp@test'),
  ('00000000-0000-0000-0000-0000000000e2', 'emp2@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.customers (id, name, phone, credit_limit) values ('00000000-0000-0000-0000-0000000000d1', 'Marta', '1155550000', 20000);

create function pg_temp.op(p_kind text, p_amount numeric, p_sign int default null) returns jsonb language sql as $$
  select jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'credit_movement', 'createdAt', now(),
    'payload', jsonb_build_object('customerId', '00000000-0000-0000-0000-0000000000d1', 'movementKind', p_kind, 'amount', p_amount,
      'adjustmentSign', p_sign, 'note', 'test'))
$$;
-- Desde 20260923100000 las funciones nuevas no son ejecutables por defecto: se concede explícito.
grant execute on function pg_temp.op(text, numeric, int) to authenticated;

-- Empleado 1 fía 5000; empleado 2 cobra un abono de 2000 (un saldo, dos cajeros).
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select ok(public.apply_offline_operation(pg_temp.op('charge', 5000)), 'Empleado registra un fiado');
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
set role authenticated;
select ok(public.apply_offline_operation(pg_temp.op('payment', 2000)), 'Otro empleado registra un abono');
select is((select balance from public.customer_accounts where id = '00000000-0000-0000-0000-0000000000d1'), 3000.00::numeric,
  'RF-46: el saldo suma cargos y abonos de todos los cajeros, aunque el empleado solo vea sus movimientos');
select is((select credit_limit from public.customer_accounts where id = '00000000-0000-0000-0000-0000000000d1'), 20000.00::numeric,
  'RF-47: el empleado ve el tope para decidir el fiado');
select is((select count(*)::int from public.customer_movements('00000000-0000-0000-0000-0000000000d1')), 2,
  'El historial muestra los movimientos de todos los cajeros');
select throws_ok($$select public.apply_offline_operation(pg_temp.op('adjustment', 1000, 1))$$, '42501', null,
  'RF-48: el empleado no ajusta deudas');
reset role;

-- Administradora: sube por inflación 1000 y después perdona 500.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select ok(public.apply_offline_operation(pg_temp.op('adjustment', 1000, 1)), 'Administradora ajusta la deuda hacia arriba');
select ok(public.apply_offline_operation(pg_temp.op('adjustment', 500, -1)), 'Administradora perdona parte de la deuda');
select is((select balance from public.customer_accounts where id = '00000000-0000-0000-0000-0000000000d1'), 3500.00::numeric,
  'RF-48: 3000 + 1000 − 500 = 3500');
reset role;

select throws_ok($$insert into public.credit_movements (local_id, customer_id, kind, amount, user_id, occurred_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000d1', 'adjustment', 10, '00000000-0000-0000-0000-0000000000a1', now())$$,
  '23514', null, 'Un ajuste sin sentido (+/−) no se acepta');

set role anon;
select throws_ok('select * from public.customer_accounts', '42501', null, 'anon no ve cuentas de clientes');
reset role;

select * from finish();
rollback;
