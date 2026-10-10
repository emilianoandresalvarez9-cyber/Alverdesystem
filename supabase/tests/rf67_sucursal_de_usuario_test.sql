-- RF-67: el Administrador asigna a cada usuario su sucursal. Nadie más puede cambiar la sucursal,
-- el rol ni el estado de un perfil: ni el propio ni el ajeno. Roles: administradora activa,
-- administradora dada de baja, empleado, otro empleado y anon. (Antes los tests fijaban
-- branch_id como superusuario y esto no estaba probado.)
begin;
select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000a2', 'exadmin@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'emp@test'),
  ('00000000-0000-0000-0000-0000000000e2', 'emp2@test'),
  ('00000000-0000-0000-0000-0000000000e9', 'baja@test'),
  ('00000000-0000-0000-0000-0000000000f7', 'sinperfil@test');
-- Una cuenta sin perfil (por ejemplo, si se borró a mano): nadie salvo administración se lo crea.
delete from public.profiles where id = '00000000-0000-0000-0000-0000000000f7';
update public.profiles set role = 'administrator'
  where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
update public.profiles set active = false
  where id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e9');
insert into public.branches (id, name, created_at) values
  ('00000000-0000-0000-0000-000000000b01', 'Central', '1990-01-01'),
  ('00000000-0000-0000-0000-000000000b09', 'Norte', now());
update public.profiles set branch_id = '00000000-0000-0000-0000-000000000b01';

-- ---------- Administradora activa: asigna la sucursal de otra persona ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select lives_ok($$update public.profiles set branch_id = '00000000-0000-0000-0000-000000000b09' where id = '00000000-0000-0000-0000-0000000000e1'$$,
  'Administradora: asigna Norte al empleado');
select is((select count(*)::int from public.profiles), 5, 'Administradora: ve a todo el personal');
reset role;
select is((select branch_id from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'), '00000000-0000-0000-0000-000000000b09'::uuid,
  'El empleado quedó en Norte');

-- ---------- Empleado: no se cambia nada a sí mismo ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select is((select public.current_branch_id()), '00000000-0000-0000-0000-000000000b09'::uuid,
  'Empleado: trabaja en la sucursal que le asignaron');
update public.profiles set branch_id = '00000000-0000-0000-0000-000000000b01' where id = '00000000-0000-0000-0000-0000000000e1';
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-0000000000e1';
update public.profiles set branch_id = '00000000-0000-0000-0000-000000000b09' where id = '00000000-0000-0000-0000-0000000000e2';
update public.profiles set active = true where id = '00000000-0000-0000-0000-0000000000e9';
select is((select count(*)::int from public.profiles), 1, 'Empleado: sólo ve su propio perfil');
select throws_ok($$insert into public.profiles (id, display_name, role) values ('00000000-0000-0000-0000-0000000000f7', 'x', 'administrator')$$,
  '42501', null, 'Empleado: no le crea un perfil de administración a una cuenta sin perfil');
reset role;
select is((select branch_id from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'), '00000000-0000-0000-0000-000000000b09'::uuid,
  'Empleado: no se cambió de sucursal');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'), 'employee',
  'Empleado: no se subió a administrador');
select is((select branch_id from public.profiles where id = '00000000-0000-0000-0000-0000000000e2'), '00000000-0000-0000-0000-000000000b01'::uuid,
  'Empleado: no cambió la sucursal de otro empleado');
select is((select active from public.profiles where id = '00000000-0000-0000-0000-0000000000e9'), false,
  'Empleado: no reactivó a nadie');

-- ---------- Empleado dado de baja: no se reactiva solo ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e9';
set role authenticated;
update public.profiles set active = true where id = '00000000-0000-0000-0000-0000000000e9';
reset role;
select is((select active from public.profiles where id = '00000000-0000-0000-0000-0000000000e9'), false,
  'Dado de baja: no se reactiva a sí mismo');

-- ---------- Administradora dada de baja ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
set role authenticated;
update public.profiles set branch_id = '00000000-0000-0000-0000-000000000b01' where id = '00000000-0000-0000-0000-0000000000e1';
update public.profiles set active = true where id = '00000000-0000-0000-0000-0000000000a2';
reset role;
select is((select branch_id from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'), '00000000-0000-0000-0000-000000000b09'::uuid,
  'Administradora de baja: no asigna sucursales');
select is((select active from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'), false,
  'Administradora de baja: no se reactiva sola');

-- ---------- anon ----------
set role anon;
select throws_ok($$select count(*) from public.profiles$$, '42501', null, 'anon: no lee perfiles');
select throws_ok($$update public.profiles set branch_id = null$$, '42501', null, 'anon: no cambia perfiles');
reset role;

select * from finish();
rollback;
