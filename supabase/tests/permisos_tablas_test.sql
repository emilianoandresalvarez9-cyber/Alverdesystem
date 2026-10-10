-- Las tablas que lee el respaldo completo tienen permiso explícito para authenticated y nada para anon.
begin;
select plan(9);

select ok(has_table_privilege('authenticated', 'public.stock_warnings', 'select'), 'authenticated puede consultar stock_warnings (RLS filtra a administración)');
select ok(has_table_privilege('authenticated', 'public.missing_items', 'select'), 'authenticated puede consultar missing_items');
select ok(has_table_privilege('authenticated', 'public.cash_shifts', 'select'), 'authenticated puede consultar cash_shifts');
select is(has_table_privilege('anon', 'public.stock_warnings', 'select'), false, 'anon no lee stock_warnings');
select is(has_table_privilege('anon', 'public.missing_items', 'select'), false, 'anon no lee missing_items');
select is(has_table_privilege('anon', 'public.cash_shifts', 'select'), false, 'anon no lee cash_shifts');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aa01', 'perm-admin@test'),
  ('00000000-0000-0000-0000-00000000aa02', 'perm-emp@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-00000000aa01';
insert into public.stock_warnings (message) values ('permisos: aviso de prueba');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000aa01';
set role authenticated;
select lives_ok($$select count(*) from public.stock_warnings$$, 'La administradora lee stock_warnings sin "permission denied" (respaldo)');
select ok((select count(*) from public.stock_warnings where message = 'permisos: aviso de prueba') = 1, 'y ve el aviso');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000aa02';
set role authenticated;
select is((select count(*)::int from public.stock_warnings where message = 'permisos: aviso de prueba'), 0,
  'El permiso no abre los datos: el empleado sigue sin ver avisos (RLS)');
reset role;

select * from finish();
rollback;
