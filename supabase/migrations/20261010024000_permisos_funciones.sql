-- Permisos explícitos para dos funciones que usan los usuarios logueados y que se crearon
-- después de 20260923100000_seguridad_rls (que quitó el EXECUTE por defecto a las funciones
-- nuevas). En producción, sin privilegios automáticos, fallaban:
--   * is_api_role(): la llaman los controles de clientes y de ventas (guard_customer_admin_fields,
--     guard_sale_immutability). Sin permiso no se podía crear un cliente, registrar fiado ni anular.
--   * credit_movement_delta(): calcula el saldo del fiado (vista customer_accounts, historial).
-- Las dos son de solo lectura y no exponen datos: es seguro que las ejecute cualquier usuario logueado.

grant execute on function public.is_api_role() to authenticated;
grant execute on function public.credit_movement_delta(public.credit_movement_kind, numeric, smallint) to authenticated;

revoke execute on function public.is_api_role() from anon, public;
revoke execute on function public.credit_movement_delta(public.credit_movement_kind, numeric, smallint) from anon, public;
