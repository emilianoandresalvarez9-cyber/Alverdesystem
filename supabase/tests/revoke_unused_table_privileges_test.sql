begin;
select plan(9);

select is(has_table_privilege('authenticated', 'public.cash_shifts', 'TRUNCATE'), false, 'authenticated cannot truncate cash_shifts');
select is(has_table_privilege('authenticated', 'public.cash_shifts', 'TRIGGER'), false, 'authenticated cannot create triggers on cash_shifts');
select is(has_table_privilege('authenticated', 'public.cash_shifts', 'REFERENCES'), false, 'authenticated cannot add references to cash_shifts');
select is(has_table_privilege('authenticated', 'public.missing_items', 'TRUNCATE'), false, 'authenticated cannot truncate missing_items');
select is(has_table_privilege('authenticated', 'public.missing_items', 'TRIGGER'), false, 'authenticated cannot create triggers on missing_items');
select is(has_table_privilege('authenticated', 'public.missing_items', 'REFERENCES'), false, 'authenticated cannot add references to missing_items');
select is(has_table_privilege('authenticated', 'public.stock_warnings', 'TRUNCATE'), false, 'authenticated cannot truncate stock_warnings');
select is(has_table_privilege('authenticated', 'public.stock_warnings', 'TRIGGER'), false, 'authenticated cannot create triggers on stock_warnings');
select is(has_table_privilege('authenticated', 'public.stock_warnings', 'REFERENCES'), false, 'authenticated cannot add references to stock_warnings');

select * from finish();
rollback;

