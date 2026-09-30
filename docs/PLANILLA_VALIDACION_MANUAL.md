# Planilla de validación manual QA

**Estado al 30/09/2026: pendiente de ejecución.** Dejar las casillas sin marcar hasta observar y registrar el resultado. La suite automática no sustituye esta planilla.

## Datos de la ejecución

- Entorno / URL (sin secretos): ______________________________
- Commit desplegado: _________________________________________
- Supabase (local/staging/producción): _______________________
- Fecha y hora: ______________________________________________
- Dispositivo / sistema / navegador: __________________________
- Usuario QA y roles usados: __________________________________

## Preparación

- [ ] Usar entorno aislado con datos de prueba; no ejecutar escenarios destructivos en datos reales.
- [ ] Registrar versión del frontend y confirmar conexión con Supabase.
- [ ] Crear una cuenta Administrador y una Empleado.
- [ ] Preparar productos, presentaciones, lotes, stock y cliente de prueba.
- [ ] Confirmar que se puede inspeccionar la base y la cola local sin capturar secretos.

## Autenticación, permisos y catálogo

- [ ] Inicio/cierre de sesión correcto para Administrador.
- [ ] Inicio/cierre de sesión correcto para Empleado en sesión independiente.
- [ ] El empleado no recibe costos, márgenes ni multiplicadores desde la API/vistas ni en almacenamiento local.
- [ ] Empleado consulta y filtra productos desde móvil.
- [ ] Administrador crea/edita producto, presentación, marca/rubro/etiqueta y precio.
- [ ] Exportaciones respetan permisos y el conjunto filtrado.
- Resultado / defecto / evidencia: ____________________________________________

## Stock, caja, ventas y fiado

- [ ] Escaneo del código con lector configurado como teclado.
- [ ] Venta en efectivo y otros medios permitidos; importes persistidos correctamente.
- [ ] Venta por peso manual: peso y precio calculados correctamente.
- [ ] Descuento del lote esperado y actualización del stock.
- [ ] Operación de fraccionamiento/granel y merma esperada.
- [ ] Cantidades o precios inválidos se rechazan.
- [ ] Fiado y pago actualizan el saldo desde movimientos sin duplicar.
- [ ] Empleado no puede anular venta ni ajustar/perdonar deuda.
- Resultado / defecto / evidencia: ____________________________________________

## Offline, recuperación y conflictos

- [ ] Abrir la app desde localhost o HTTPS y esperar que el Service Worker esté activo.
- [ ] Desconectar red, registrar operaciones admitidas y verificar persistencia en cola local.
- [ ] Cerrar abruptamente el navegador/dispositivo, reabrir sin red y comprobar recuperación de operaciones.
- [ ] Reconectar y verificar sincronización, resultado en base y cola sin duplicados.
- [ ] Reenviar un mismo identificador local y verificar idempotencia.
- [ ] Probar dos puestos sobre stock limitado y confirmar el resultado/alerta previsto.
- [ ] Revisar el respaldo secundario autorizado por el navegador y recuperación del permiso.
- Resultado / defecto / evidencia: ____________________________________________

## Respaldo, restauración y operación

- [ ] Generar backup/exportación y confirmar contenido y permisos.
- [ ] Restaurar en una base/dispositivo de prueba limpio.
- [ ] Comparar productos, lotes, movimientos, clientes y operaciones pendientes antes/después.
- [ ] Documentar despliegue, configuración de entorno y procedimiento de recuperación.
- [ ] Confirmar con la dueña continuidad del negocio ante corte de energía (la app requiere equipo alimentado).
- Resultado / defecto / evidencia: ____________________________________________

## Cierre QA

- Defectos / enlaces a issues: _______________________________________________
- Reejecución y commit: ______________________________________________________
- Firma QA independiente: _______________________ Fecha: ____________________
- Veredicto: [ ] Aprobado para el alcance comprobado  [ ] Rechazado  [ ] Bloqueado

El veredicto no debe generalizarse a escenarios o requisitos que no se hayan ejecutado.
