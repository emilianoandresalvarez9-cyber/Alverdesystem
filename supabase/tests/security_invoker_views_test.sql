begin;
select plan(28);

insert into public.branches (id, name) values
  ('00000000-0000-0000-0000-000000009001', 'Invocador Centro'),
  ('00000000-0000-0000-0000-000000009002', 'Invocador Norte');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000009003', 'invoker-employee-a@test'),
  ('00000000-0000-0000-0000-000000009004', 'invoker-employee-b@test'),
  ('00000000-0000-0000-0000-000000009005', 'invoker-admin@test'),
  ('00000000-0000-0000-0000-000000009006', 'invoker-inactive@test');
update public.profiles set branch_id = '00000000-0000-0000-0000-000000009001'
where id = '00000000-0000-0000-0000-000000009003';
update public.profiles set branch_id = '00000000-0000-0000-0000-000000009002'
where id = '00000000-0000-0000-0000-000000009004';
update public.profiles set role = 'administrator'
where id = '00000000-0000-0000-0000-000000009005';
update public.profiles set active = false
where id = '00000000-0000-0000-0000-000000009006';

insert into public.products (id, name, base_unit, price_multiplier)
values ('00000000-0000-0000-0000-000000009007', 'Invocador producto', 'unit', 2.5);
insert into public.product_presentations (id, product_id, name, base_quantity, sale_price)
values ('00000000-0000-0000-0000-000000009008', '00000000-0000-0000-0000-000000009007', 'Invocador unidad', 1, 100);
insert into public.stock_lots (id, presentation_id, initial_quantity, current_quantity, purchase_cost, status, branch_id)
values
  ('00000000-0000-0000-0000-000000009009', '00000000-0000-0000-0000-000000009008', 5, 5, 40, 'open', '00000000-0000-0000-0000-000000009001'),
  ('00000000-0000-0000-0000-000000009010', '00000000-0000-0000-0000-000000009008', 7, 7, 50, 'open', '00000000-0000-0000-0000-000000009002');
insert into public.branch_prices (branch_id, presentation_id, sale_price)
values ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000009008', 110);
insert into public.customers (id, name, credit_limit)
values ('00000000-0000-0000-0000-000000009011', 'Invocador cliente', 500);
insert into public.credit_movements (local_id, customer_id, kind, amount, user_id, occurred_at)
values
  ('00000000-0000-0000-0000-000000009012', '00000000-0000-0000-0000-000000009011', 'charge', 200, '00000000-0000-0000-0000-000000009003', now()),
  ('00000000-0000-0000-0000-000000009013', '00000000-0000-0000-0000-000000009011', 'payment', 50, '00000000-0000-0000-0000-000000009004', now());

select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.employee_catalog'::regclass), 'employee_catalog is SECURITY INVOKER');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.employee_stock_lots'::regclass), 'employee_stock_lots is SECURITY INVOKER');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.customer_accounts'::regclass), 'customer_accounts is SECURITY INVOKER');
select is(has_table_privilege('anon', 'public.employee_catalog', 'SELECT'), false, 'anon has no employee_catalog grant');
select is(has_table_privilege('anon', 'public.employee_stock_lots', 'SELECT'), false, 'anon has no employee_stock_lots grant');
select is(has_table_privilege('anon', 'public.customer_accounts', 'SELECT'), false, 'anon has no customer_accounts grant');
select is(has_function_privilege('anon', 'private.employee_catalog_projection()', 'EXECUTE'), false, 'anon cannot execute the private catalog projection');
select is(has_function_privilege('anon', 'private.employee_stock_lots_projection()', 'EXECUTE'), false, 'anon cannot execute the private stock projection');
select is(has_function_privilege('anon', 'private.customer_accounts_projection()', 'EXECUTE'), false, 'anon cannot execute the private customer projection');

set role anon;
select throws_ok('select * from public.employee_catalog', '42501', null, 'anon cannot query employee_catalog');
select throws_ok('select * from public.employee_stock_lots', '42501', null, 'anon cannot query employee_stock_lots');
select throws_ok('select * from public.customer_accounts', '42501', null, 'anon cannot query customer_accounts');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000009003';
set role authenticated;
select is((select count(*)::int from public.employee_catalog), 1, 'active employee can read the product catalog');
select is((select count(*)::int from public.employee_stock_lots), 1, 'employee sees only stock in their assigned branch');
select throws_ok('select price_multiplier from public.employee_catalog', '42703', null, 'employee catalog does not expose price_multiplier');
select throws_ok('select purchase_cost from public.employee_stock_lots', '42703', null, 'employee stock view does not expose purchase_cost');
select is((select count(*)::int from public.products), 0, 'RLS still hides base products from employees');
select is((select count(*)::int from public.stock_lots), 0, 'RLS still hides base stock lots from employees');
select ok((select branch_prices ? '00000000-0000-0000-0000-000000009001' from public.employee_catalog limit 1), 'catalog retains branch pricing needed by the POS');
select is((select balance from public.customer_accounts where id = '00000000-0000-0000-0000-000000009011'), 150.00::numeric, 'customer balance includes movements recorded by every employee');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000009004';
set role authenticated;
select is((select count(*)::int from public.employee_stock_lots), 1, 'second employee sees only stock in their own branch');
select is((select balance from public.customer_accounts where id = '00000000-0000-0000-0000-000000009011'), 150.00::numeric, 'second employee sees the same complete customer balance');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000009005';
set role authenticated;
select is((select count(*)::int from public.employee_stock_lots), 2, 'administrator retains stock visibility across branches');
select lives_ok('select price_multiplier from public.products', 'administrator retains access to sensitive product fields');
select lives_ok('select purchase_cost from public.stock_lots', 'administrator retains access to purchase costs');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000009006';
set role authenticated;
select is((select count(*)::int from public.employee_catalog), 0, 'inactive profile cannot read the catalog');
select is((select count(*)::int from public.employee_stock_lots), 0, 'inactive profile cannot read stock projections');
select is((select count(*)::int from public.customer_accounts), 0, 'inactive profile cannot read customer accounts');
reset role;

select * from finish();
rollback;

