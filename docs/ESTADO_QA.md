# Estado QA por requisito

Actualizado con PR-01 a PR-09. "Probado" significa que hay un test automatizado que falla si el
requisito se rompe. Nada de esto está verificado todavía en el hardware real (ver T-03).

| Requisito | Estado | Evidencia |
|---|---|---|
| RF-01 a RF-06 Catálogo, filtros, exportación | Implementado | Revisión previa; `rls_catalog_test.sql` para el acceso de empleado |
| RF-07, RF-08, RF-09 Lotes, vencimiento efectivo, FEFO | Probado en venta | `venta_contrato_test.sql` (FEFO por vencimiento efectivo) |
| RF-10 Listado de lotes | Implementado | Sin test automatizado |
| RF-11 a RF-17b Fraccionamiento y granel | Parcial | Lógica probada (`fractioningLogic.test.ts`); escritura no atómica (T-01) y unidades por decidir (T-02) |
| RF-18 a RF-23 Códigos de barra | Probado | `ean13.test.ts`, `catalogLookup.test.ts`, `scanDetector.test.ts` |
| RF-24 a RF-30 Proveedores y precios | Pendiente | T-10, T-12 |
| RF-31 Ventas con medio de pago | Probado | `venta_contrato_test.sql`, `cart.test.ts`, `saleContract.test.ts` |
| RF-32 Cierre por medio de pago | Probado | `shiftSummary.test.ts`, `shift_totals` en `venta_contrato_test.sql` |
| RF-33 Peso manual | Probado | `cart.test.ts`, `money.test.ts` (redondeo idéntico a Postgres) |
| RF-33b Interfaz de balanza | Implementado | `src/modules/pos/scaleInterface.ts` (sin implementar, por diseño) |
| RF-34 a RF-37 Offline, idempotencia, solo agregar | Probado | `queue.test.ts`, reintento en `venta_contrato_test.sql`, `legacy.test.ts` |
| RF-38 Stock negativo sin bloquear | Probado | `venta_contrato_test.sql` (antes de PR-04 nunca funcionó: P10) |
| RF-39, RF-40 Precios sin conexión, segunda copia | Implementado | Sin test automatizado |
| RF-41 Respaldo al cerrar caja | Probado | `backupService.test.ts` (antes respaldaba una base vacía: P11) |
| RF-42 a RF-44 Respaldo externo, exportar, restaurar | Pendiente | T-09, T-14 |
| RF-45 a RF-48 Clientes y fiado | Probado | `clientes_fiado_test.sql`, `balance.test.ts`, `seguridad_rls_test.sql` |
| RF-49 Faltantes desde el celular | Probado | `faltantes_offline_test.sql` (antes no existía: P12) |
| RF-50, RF-51 Reposición e ingreso rápido | Parcial | Ingreso no atómico e ignora errores (T-01) |
| RF-53, RF-55, RF-56 Sucursales, cajas, archivar | Probado | `sucursales_test.sql` |
| RF-57, RF-58, RF-60 Ajustes con motivo, auditoría | Implementado | Ajuste no atómico (T-01) |
| RF-59 Cuenta por administradora | Probado | `roles.test.ts` |
| RF-61 a RF-64 Reportes | Parcial | Calculados en el navegador (T-06) |
| RNF-04 Costos fuera del rol Empleado | Probado | `smoke_test.sql`, `rls_catalog_test.sql`, `seguridad_rls_test.sql` |
| RNF-10 Credenciales | Verificado | Sin claves en el historial de git (revisión QA) |

## Defectos QA encontrados en esta revisión

| Id | Defecto | Corregido en |
|---|---|---|
| P1 | Catálogo legible sin login (`anon`) | PR-03 |
| P2 | Nadie, ni la administradora, podía registrar movimientos de stock | PR-03 |
| P3 | Un empleado podía perdonar deudas vía la cola offline | PR-03 |
| P4 | Un empleado podía cambiar el tope de fiado | PR-03 |
| P5 | Venta fiada guardada como efectivo, total manipulable, sin cargo ni movimientos | PR-04 |
| P6 | Empleados insertaban ventas directo, sin FEFO | PR-03 |
| P7 | Un empleado podía reabrir y editar un turno cerrado | PR-03 |
| P8 | Con 2+ usuarios, el administrador entraba al catálogo | PR-02 |
| P9 | Función `security definer` sin `search_path` | PR-03 |
| P10 | Stock negativo hacía fallar la venta (RF-38 nunca funcionó) | PR-04 |
| P11 | El respaldo de cierre respaldaba una base inexistente | PR-05 |
| P12 | RF-49 no existía (página de faltantes era un simulador sin montar) | PR-07 |
| — | CI de base de datos siempre verde (`psql -f` ignora fallas) | PR-01 |
