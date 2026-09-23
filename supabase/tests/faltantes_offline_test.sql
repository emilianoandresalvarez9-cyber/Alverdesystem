-- Tests de 20260923131000_faltantes_offline.sql (RF-49).
begin;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'emp@test');
update public.profiles set role = 'administrator' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.products (id, name, base_unit) values ('00000000-0000-0000-0000-0000000000f1', 'Pasas de uva', 'gram');

create function pg_temp.aviso() returns jsonb language sql as $$
  select jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'missing_item', 'createdAt', now(),
    'payload', jsonb_build_object('productId', '00000000-0000-0000-0000-0000000000f1', 'note', 'Quedan 2 bolsas'))
$$;
grant execute on function pg_temp.aviso() to authenticated;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select ok(public.apply_offline_operation(pg_temp.aviso()), 'RF-49: un empleado avisa un faltante por la cola offline');
select ok(public.apply_offline_operation(pg_temp.aviso()), 'Un segundo aviso del mismo producto se acepta');
select throws_ok($$select public.apply_offline_operation(jsonb_build_object('localId', gen_random_uuid(), 'deviceId', gen_random_uuid(), 'kind', 'missing_item', 'payload', '{}'::jsonb))$$,
  '22023', null, 'Un aviso sin producto se rechaza');
reset role;

select is((select count(*)::int from public.missing_items where product_id = '00000000-0000-0000-0000-0000000000f1' and not resolved), 1,
  'Dos avisos sin reponer son un solo faltante');
select is((select reported_by from public.missing_items where product_id = '00000000-0000-0000-0000-0000000000f1'), '00000000-0000-0000-0000-0000000000e1'::uuid,
  'El faltante queda a nombre de quien avisó');

update public.missing_items set resolved = true where product_id = '00000000-0000-0000-0000-0000000000f1';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select public.apply_offline_operation(pg_temp.aviso());
reset role;
select is((select count(*)::int from public.missing_items where product_id = '00000000-0000-0000-0000-0000000000f1'), 2,
  'Después de reponer, un aviso nuevo abre otro faltante');

select * from finish();
rollback;
