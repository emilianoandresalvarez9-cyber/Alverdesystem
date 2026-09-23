-- smoke_test.sql — verificación del esquema de Fase 0
-- Fuente de verdad: supabase/migrations/20260922060000_phase_0_foundation.sql
-- Todas las tablas usan nombres en inglés (convención del esquema de Codex)
-- Correr después de: supabase db reset

-- 1. Verificar que existen las 19 tablas del esquema de Fase 0
do $$ begin
  assert (
    select count(*) from information_schema.tables
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
  ) = 19,
  'Faltan tablas en el esquema de Fase 0 (nombres en inglés)';
end $$;

-- 2. Verificar que la vista employee_catalog existe
do $$ begin
  assert (
    select count(*) from information_schema.views
    where table_schema = 'public' and table_name = 'employee_catalog'
  ) = 1,
  'Falta la vista employee_catalog';
end $$;

-- 3. Verificar que employee_catalog NO expone campos de costo (RNF-04)
do $$ begin
  assert (
    select count(*) from information_schema.columns
    where table_schema = 'public'
    and table_name = 'employee_catalog'
    and column_name in ('price_multiplier', 'cost', 'purchase_cost', 'costo_compra')
  ) = 0,
  'La vista employee_catalog expone campos de costo — falla de seguridad RNF-04';
end $$;

-- 4. Verificar que la función RPC apply_offline_operation existe
do $$ begin
  assert (
    select count(*) from pg_proc
    where proname = 'apply_offline_operation'
    and pronamespace = 'public'::regnamespace
  ) = 1,
  'Falta la función RPC apply_offline_operation';
end $$;

-- 5. Verificar que RLS está habilitado en las tablas críticas
do $$ begin
  assert (
    select count(*) from pg_tables
    where schemaname = 'public'
    and tablename in ('profiles', 'supplier_products', 'stock_lots', 'sales')
    and rowsecurity = true
  ) = 4,
  'RLS no está habilitado en todas las tablas críticas';
end $$;

raise notice 'Smoke test OK: 19 tablas, vista employee_catalog, RPC y RLS verificados.';
