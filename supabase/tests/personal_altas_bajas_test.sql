-- Tests de 20261010080000_personal_altas_y_bajas.sql (RF-59, RF-60): administración activa y da de
-- baja personal; nadie se da de baja a sí mismo; siempre queda una persona de administración
-- activa; cada cambio de acceso, rol o sucursal queda en el historial.
-- Roles: administradora, otra administradora, empleado, empleado dado de baja, SQL Editor y anon.
begin;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'luciana@test', '{"display_name": "Luciana"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'sofia@test', '{"display_name": "Sofía"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'tomas@test', '{"display_name": "Tomás"}'),
  ('00000000-0000-0000-0000-0000000000e9', 'ex@test', '{"display_name": "Exempleado"}');
update public.profiles set role = 'administrator'
  where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
update public.profiles set active = false where id = '00000000-0000-0000-0000-0000000000e9';
insert into public.branches (id, name, created_at) values ('00000000-0000-0000-0000-000000000b09', 'Norte', now());
select is((select count(*)::int from public.audit_history where entity = 'profiles' and user_id is null), 3,
  'Los cambios hechos desde el SQL Editor también quedan en el historial, sin usuario');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select lives_ok($$update public.profiles set active = false where id = '00000000-0000-0000-0000-0000000000e1'$$,
  'Administradora: da de baja a un empleado');
select lives_ok($$update public.profiles set active = true where id = '00000000-0000-0000-0000-0000000000e9'$$,
  'Administradora: vuelve a activar a alguien');
select lives_ok($$update public.profiles set branch_id = '00000000-0000-0000-0000-000000000b09' where id = '00000000-0000-0000-0000-0000000000e9'$$,
  'Administradora: le asigna sucursal');
select throws_like($$update public.profiles set active = false where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'No podés darte de baja a vos misma%', 'Nadie se da de baja a sí mismo');
select lives_ok($$update public.profiles set active = false where id = '00000000-0000-0000-0000-0000000000a2'$$,
  'Administradora: da de baja a otra administradora si ella sigue activa');
select throws_like($$update public.profiles set role = 'employee' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'Tiene que quedar al menos una persona de administración activa.', 'No se le quita el rol a la última administradora activa');
select lives_ok($$update public.profiles set active = true where id = '00000000-0000-0000-0000-0000000000a2'$$,
  'Administradora: reactiva a la otra administradora');
reset role;

select is((select active from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'), false, 'El empleado quedó dado de baja');
select is((select count(*)::int from public.audit_history
  where entity = 'profiles' and entity_id = '00000000-0000-0000-0000-0000000000e1' and field = 'active'
    and old_value = to_jsonb('true'::text) and new_value = to_jsonb('false'::text)
    and user_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'La baja queda en el historial: quién, antes y después');
select is((select count(*)::int from public.audit_history
  where entity = 'profiles' and entity_id = '00000000-0000-0000-0000-0000000000e9' and field in ('active', 'branch_id')
    and user_id = '00000000-0000-0000-0000-0000000000a1'), 2,
  'La reactivación y el cambio de sucursal también quedan');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select is((select entity_label from public.audit_history_search(p_entity => 'profiles')
  where entity_id = '00000000-0000-0000-0000-0000000000e1' limit 1), 'Tomás',
  'Trazabilidad muestra a la persona con su nombre');
reset role;

-- Desde el SQL Editor el dueño puede corregir cualquier cosa, aun dejar sin administración.
select lives_ok($$update public.profiles set active = false where role = 'administrator'$$,
  'SQL Editor: sin las reglas de la app');

set role anon;
select throws_ok($$update public.profiles set active = true$$, '42501', null, 'anon: no cambia perfiles');
reset role;

select * from finish();
rollback;
