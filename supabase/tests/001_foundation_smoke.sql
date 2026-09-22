-- Run after migrations against a disposable local Supabase database.
do $$
declare
  required_tables text[] := array[
    'branches', 'registers', 'profiles', 'brands', 'categories', 'labels',
    'products', 'product_labels', 'product_presentations', 'suppliers',
    'supplier_products', 'stock_lots', 'sales', 'sale_items', 'stock_movements',
    'customers', 'credit_movements', 'audit_history', 'offline_operations'
  ];
  table_name text;
begin
  foreach table_name in array required_tables loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and tables.table_name = table_name
    ) then
      raise exception 'Missing required table: %', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stock_lots'
  ) then
    raise exception 'stock_lots must be protected by RLS policies';
  end if;

  if not exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'employee_catalog'
  ) then
    raise exception 'Missing restricted employee catalogue view';
  end if;
end $$;
