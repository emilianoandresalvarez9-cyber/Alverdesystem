-- Activa la cuenta del empleado de las pruebas E2E (las cuentas nuevas nacen inactivas):
-- la del CI y la que usan por defecto las pruebas en una base local. Correr después de crearla.
-- Una sola sentencia: `supabase db query --file` envía una sentencia preparada.
update public.profiles
set active = true
where id in (select id from auth.users where email in ('e2e-employee@alverde.local', 'empleado@alverde.local'));
