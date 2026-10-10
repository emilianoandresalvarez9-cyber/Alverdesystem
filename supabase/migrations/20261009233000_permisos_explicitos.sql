-- Permisos explícitos para tres tablas creadas después de la base inicial sin GRANT propio.
-- Dependían de los privilegios por defecto de Supabase, que el proyecto de producción no aplica:
-- el respaldo completo (RF-41) falló con "permission denied for table stock_warnings".
-- Las políticas RLS ya existentes siguen decidiendo qué filas ve y toca cada usuario:
--   stock_warnings: solo administración lee (se escribe por RPC security definer);
--   missing_items: todos leen y reportan los propios; solo administración resuelve;
--   cash_shifts: cada cajero ve y abre los suyos; administración gestiona.

grant select on public.stock_warnings to authenticated;
grant select, insert, update on public.missing_items to authenticated;
grant select, insert, update on public.cash_shifts to authenticated;

revoke all on public.stock_warnings, public.missing_items, public.cash_shifts from anon;
