-- Contrato que usa la caja: la administradora crea sucursales y cajas; todos las leen (RF-53, RF-55).
begin;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'emp@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-0000000000a1';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select lives_ok($$insert into public.branches (id, name) values ('00000000-0000-0000-0000-000000000b01', 'Central')$$, 'Administradora crea una sucursal');
select lives_ok($$insert into public.registers (branch_id, name) values ('00000000-0000-0000-0000-000000000b01', 'Caja 2')$$, 'RF-55: agregar una caja es un alta de datos');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select is((select count(*)::int from public.registers where archived_at is null), 1, 'El empleado ve las cajas para elegir la de su equipo');
select throws_ok($$insert into public.registers (branch_id, name) values ('00000000-0000-0000-0000-000000000b01', 'Caja pirata')$$, '42501', null, 'El empleado no crea cajas');
select is((select count(*)::int from (select 1 from public.registers r where r.name = 'Caja 2' and exists (select 1 from public.branches b where b.id = r.branch_id)) x), 1,
  'La lectura de caja con su sucursal funciona para el empleado (listRegisters)');
reset role;

select * from finish();
rollback;
