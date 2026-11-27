# Revisión QA: seguridad de vistas y privilegios de tablas

Fecha: 2026-10-22  
Rama: `codex/supabase-security-migrations-20261022`  
Base: `main` (`6423903890b23d90d9db5c70150f9d0494ef8017`)

## Alcance del cambio

- Se prepara una migración para que `employee_catalog`, `employee_stock_lots` y `customer_accounts` tengan `security_invoker = true` y `security_barrier = true`.
- Las vistas conservan el comportamiento que necesitan los empleados mediante funciones limitadas en el esquema `private`, que no está expuesto por la API de PostgREST. Las funciones comprueban que el perfil esté activo; la proyección de lotes limita al empleado a su sucursal. Ninguna proyección incluye `price_multiplier` ni `purchase_cost`.
- Se prepara una migración que revoca `TRUNCATE`, `TRIGGER` y `REFERENCES` de `authenticated` en `cash_shifts`, `missing_items` y `stock_warnings`.
- Se agregan pruebas negativas de permisos, pruebas de visibilidad por sucursal, perfil inactivo, acceso administrativo, campos sensibles y cálculo completo del saldo de fiado.

## Estado de RF-38 en Supabase remoto

La migración ya mergeada `20261020120000_rf38_granel_sin_faltante.sql` se aplicó al proyecto remoto `Alverdesys` (`ivyozvynqlnucowrbury`). Se consultó la definición de `guard_stock_lot_negative_floor` y se confirmó que contiene la regla `sold_by_weight` y el mensaje de rechazo por faltante a granel; ambas funciones verificadas (`guard_stock_lot_negative_floor` y `process_offline_sale`) son `SECURITY DEFINER`.

La herramienta de aplicación registró el cambio remoto con versión generada `20261022175559` y nombre `20261020120000_rf38_granel_sin_faltante`, en vez de la versión del archivo `20261020120000`. **Hay que reconciliar el historial con Supabase CLI antes de volver a ejecutar `db push`**. No se debe editar la migración ya mergeada ni volver a aplicar el SQL como una migración diferente. Usar `supabase migration repair` para registrar la versión del archivo y revertir la versión de herramienta, luego confirmar `supabase migration list --linked` sin filas divergentes.

## Validación y límites actuales

- `npm run qa:guard`: pasó; 68 archivos de test revisados.
- `npm run typecheck`: pasó.
- `npm test`: no pudo iniciar en este entorno Windows: esbuild informó `Access is denied` al leer una ruta superior del checkout. Ese error no es un fallo de una prueba. El job `frontend` de CI debe dar la señal definitiva.
- `npx --yes supabase@2.117.0 test db`: no pudo conectarse a `127.0.0.1:54322` porque Docker/Supabase local no está iniciado. El job `database` de CI debe ejecutar pgTAP.
- Las pruebas SQL nuevas se incluyen para que CI las ejecute en `database` y `database-strict`. Este documento no declara aprobadas las migraciones nuevas hasta que esos jobs pasen.
- La migración RF-38 anterior sí se ejecutó en el proyecto remoto; las dos migraciones nuevas de este PR no se aplicaron al entorno real.

## Revisión requerida

1. Confirmar que las funciones privadas no devuelven columnas de costo o margen y que las políticas de sucursal coinciden con RF-65/66.
2. Revisar los tests pgTAP nuevos y exigir resultados verdes en ambos jobs de base de datos.
3. Revisar el aviso de historial RF-38 y reconciliarlo antes de cualquier otro `db push`.
4. Después del merge, aplicar las dos migraciones nuevas por el flujo normal de migraciones y volver a consultar los permisos/vistas remotos.

La coordinación con otras personas se mantiene en los comentarios de este PR para que revisión, decisiones y resultados queden en un solo lugar.

