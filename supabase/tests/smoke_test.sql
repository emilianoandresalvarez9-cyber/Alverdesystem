-- Smoke test: verifica que las entidades y políticas esenciales existen
-- Correr con: supabase db reset (aplica migración y ejecuta seeds)

-- Verificar tablas principales
do $$ begin
  assert (select count(*) from information_schema.tables
    where table_schema = 'public'
    and table_name in (
      'marcas','rubros','etiquetas','sucursales','puestos','profiles',
      'proveedores','productos','producto_etiquetas','presentaciones',
      'proveedor_productos','lotes','clientes','ventas','venta_items',
      'movimientos_stock','movimientos_fiado','historial_cambios',
      'historial_precios','faltantes'
    )
  ) = 20,
  'Faltan tablas en el esquema';
end $$;

-- Verificar vista employee_catalog
do $$ begin
  assert (select count(*) from information_schema.views
    where table_schema = 'public' and table_name = 'employee_catalog'
  ) = 1,
  'Falta la vista employee_catalog';
end $$;

-- Verificar que la vista NO expone costo_compra
do $$ begin
  assert (select count(*) from information_schema.columns
    where table_schema = 'public'
    and table_name = 'employee_catalog'
    and column_name = 'costo_compra'
  ) = 0,
  'La vista employee_catalog expone costo_compra — falla de seguridad';
end $$;

-- Verificar función RPC
do $$ begin
  assert (select count(*) from pg_proc
    where proname = 'apply_offline_operation'
    and pronamespace = 'public'::regnamespace
  ) = 1,
  'Falta la función RPC apply_offline_operation';
end $$;

-- Verificar datos iniciales
do $$ begin
  assert (select count(*) from public.marcas where nombre = 'Del local') = 1,
  'Falta la marca Del local';

  assert (select count(*) from public.sucursales) >= 1,
  'Falta al menos una sucursal';

  assert (select count(*) from public.puestos) >= 1,
  'Falta al menos un puesto';
end $$;

raise notice 'Smoke test OK: esquema, vista, RPC y datos iniciales verificados.';
