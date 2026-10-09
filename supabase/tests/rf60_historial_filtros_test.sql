-- RF-60: historial de modificaciones consultable por producto, persona y fecha.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f601', 'rf60-admin-a@test'),
  ('00000000-0000-0000-0000-00000000f602', 'rf60-admin-b@test'),
  ('00000000-0000-0000-0000-00000000f603', 'rf60-employee@test'),
  ('00000000-0000-0000-0000-00000000f604', 'rf60-other-employee@test');
update public.profiles set role = 'administrator', display_name = 'Hija A' where id = '00000000-0000-0000-0000-00000000f601';
update public.profiles set role = 'administrator', display_name = 'Hija B' where id = '00000000-0000-0000-0000-00000000f602';

insert into public.brands (id, name) values ('00000000-0000-0000-0000-00000000f6b1', 'RF60 marca vieja');
insert into public.products (id, name, base_unit) values
  ('00000000-0000-0000-0000-00000000f6a1', 'RF60 nueces', 'gram'),
  ('00000000-0000-0000-0000-00000000f6a2', 'RF60 pasas', 'gram');
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price) values
  ('00000000-0000-0000-0000-00000000f6e1', '00000000-0000-0000-0000-00000000f6a1', 'Granel', 1000, 9000);

-- Hija A cambia el nombre de las nueces y el precio del granel; Hija B renombra la marca.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f601';
set role authenticated;
update public.products set name = 'RF60 nueces mariposa' where id = '00000000-0000-0000-0000-00000000f6a1';
update public.product_presentations set sale_price = 9500 where id = '00000000-0000-0000-0000-00000000f6e1';
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f602';
set role authenticated;
update public.brands set name = 'RF60 marca nueva' where id = '00000000-0000-0000-0000-00000000f6b1';
reset role;

-- Fechas distintas para poder filtrar: el cambio de marca queda "ayer".
update public.audit_history set occurred_at = now() - interval '1 day'
  where entity = 'brands' and entity_id = '00000000-0000-0000-0000-00000000f6b1';

select is(has_function_privilege('anon', 'public.audit_history_search(text, text, uuid, timestamptz, timestamptz, integer)', 'execute'), false,
  'anon no puede buscar en el historial');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f603';
set role authenticated;
select is((select count(*)::int from public.audit_history_search()), 0, 'Empleado no ve el historial');
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f604';
set role authenticated;
select is((select count(*)::int from public.audit_history_search('nueces')), 0, 'Otro empleado tampoco, ni buscando');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000f601';
set role authenticated;
select is((select count(*)::int from public.audit_history_search() where entity_label like 'RF60%'), 3,
  'Administradora ve los tres cambios de esta prueba');

-- Por producto: el nombre resuelto reemplaza al id, y la presentación muestra "producto · presentación"
select results_eq(
  $$select entity, entity_label, field, old_value, new_value from public.audit_history_search('nueces') order by entity$$,
  $$values ('product_presentations', 'RF60 nueces mariposa · Granel', 'sale_price', '"9000.00"'::jsonb, '"9500.00"'::jsonb),
           ('products', 'RF60 nueces mariposa', 'name', '"RF60 nueces"'::jsonb, '"RF60 nueces mariposa"'::jsonb)$$,
  'Buscar por producto devuelve qué cambió, con valor anterior y nuevo');

-- Por persona
select is((select count(*)::int from public.audit_history_search(null, null, '00000000-0000-0000-0000-00000000f602')), 1,
  'Filtrar por persona deja solo los cambios de Hija B');
select is((select user_name from public.audit_history_search(null, null, '00000000-0000-0000-0000-00000000f602')), 'Hija B',
  'Cada cambio muestra el nombre de quien lo hizo');

-- Por entidad
select is((select count(*)::int from public.audit_history_search(null, 'brands') where entity_label like 'RF60%'), 1,
  'Filtrar por tipo de entidad');
select is((select entity_label from public.audit_history_search(null, 'brands') where entity_label like 'RF60%'), 'RF60 marca nueva',
  'La marca se muestra por su nombre actual');

-- Por fecha
select is((select count(*)::int from public.audit_history_search(null, null, null, now() - interval '1 hour', null) where entity_label like 'RF60%'), 2,
  'Desde hace una hora: solo los dos cambios de hoy');
select is((select count(*)::int from public.audit_history_search(null, null, null, null, now() - interval '1 hour') where entity_label like 'RF60%'), 1,
  'Hasta hace una hora: solo el cambio de ayer');

-- Combinado: persona + texto
select is((select count(*)::int from public.audit_history_search('marca', null, '00000000-0000-0000-0000-00000000f601')), 0,
  'Persona y texto se combinan (Hija A no tocó la marca)');

-- Límite acotado
select is((select count(*)::int from public.audit_history_search(null, null, null, null, null, 1)), 1,
  'El límite se respeta');
reset role;

select * from finish();
rollback;
