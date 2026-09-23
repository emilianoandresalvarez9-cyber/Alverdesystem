begin;
select plan(5);

-- 1. Verificar que existen las 19 tablas del esquema de Fase 0
select is(
  (
    select count(*)::integer
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'branches', 'registers', 'profiles',
        'brands', 'categories', 'labels',
        'products', 'product_labels', 'product_presentations',
        'suppliers', 'supplier_products',
        'stock_lots', 'stock_movements',
        'sales', 'sale_items',
        'customers', 'credit_movements',
        'audit_history', 'offline_operations'
      )
  ),
  19,
  'Existen las 19 tablas canónicas de Fase 0'
);

-- 2. Verificar que la vista employee_catalog existe
select is(
  (
    select count(*)::integer
    from information_schema.views
    where table_schema = 'public'
      and table_name = 'employee_catalog'
  ),
  1,
  'Existe la vista employee_catalog'
);

-- 3. Verificar que employee_catalog NO expone campos de costo (RNF-04)
select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employee_catalog'
      and column_name in ('price_multiplier', 'cost', 'purchase_cost', 'costo_compra')
  ),
  0,
  'employee_catalog no expone costos ni márgenes (RNF-04)'
);

-- 4. Verificar que la función RPC apply_offline_operation existe
select is(
  (
    select count(*)::integer
    from pg_proc
    where proname = 'apply_offline_operation'
      and pronamespace = 'public'::regnamespace
  ),
  1,
  'Existe función RPC apply_offline_operation'
);

-- 5. Verificar que RLS está habilitado en las tablas críticas
select is(
  (
    select count(*)::integer
    from pg_tables
    where schemaname = 'public'
      and tablename in ('profiles', 'supplier_products', 'stock_lots', 'sales')
      and rowsecurity = true
  ),
  4,
  'RLS activo en tablas críticas'
);

select * from finish();
rollback;
