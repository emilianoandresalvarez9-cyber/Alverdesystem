# Diagnóstico QA/QC independiente — Alverde System

**Fecha:** 2026-09-23  
**Auditor:** Codex, QA/QC independiente  
**Ámbito auditado:** árbol local `C:\Users\emiliano\Alverdesystem`, requisitos funcionales y hoja de ruta de GitHub.  
**Veredicto:** **NO APROBADO PARA PRODUCCIÓN. No liberar ni declarar v1.0.0.**

## Alcance y método

`CAnti.md` se revisó como bitácora de decisiones y declaraciones de los agentes. No se usó como evidencia de corrección: cada conclusión de este informe se contrastó contra código, migraciones y pruebas ejecutables del entorno local.

El árbol local está en `main`, **44 commits por delante de `origin/main`**, con cambios sin commit en CAnti, service worker, configuración y las nuevas entradas de Caja/Clientes. GitHub remoto solo publica una hoja de ruta hasta Fase 1 y no tiene PR abiertos al momento de la revisión. Por lo tanto, el build local no prueba una entrega publicada ni revisable en GitHub.

### Verificaciones reproducibles

| Verificación | Resultado | Alcance real |
|---|---:|---|
| `npm run typecheck` | Pasa | Tipos de TypeScript; no prueba la base ni los flujos. |
| `npm test` | Pasa: 29 tests | Tests unitarios. Tres tests de integración raíz son aserciones vacías. |
| `npm run build` | Pasa | Compila las 5 entradas locales actuales. No prueba autenticación, RLS ni persistencia. |
| `npm audit --omit=dev --json` | 0 vulnerabilidades de producción | Resultado positivo, limitado al registro npm. |
| Migraciones, RPC, RLS y pruebas UI end-to-end | **No ejecutadas** | Docker no está disponible en este entorno, por lo que no se pudo levantar Supabase local. |

La ausencia de pruebas de base no es un permiso para inferir que funcionan. En particular, los defectos de esquema detallados abajo son detectables estáticamente y bloquean la liberación.

## Bloqueantes críticos (P0)

### P0-01 — Un empleado no puede cargar el catálogo operativo

`src/modules/catalog/useCatalog.ts` consulta `products`, `product_presentations` y relaciones internas directamente. La migración fundacional (`20260922060000_phase_0_foundation.sql`) solo otorga `admins manage products`; para empleados existe la proyección segura `employee_catalog`, pero la UI no la consume.

Consecuencia: un empleado autenticado no recibe los productos (o recibe una respuesta vacía por RLS), incumpliendo el caso operativo central. Cambiar la política de `products` para “arreglarlo” sería inseguro porque podría exponer campos administrativos; la corrección correcta es que el catálogo de empleado use una proyección/consulta segura, con tipos correspondientes.

**Salida exigida:** prueba con sesión de empleado que vea catálogo y precios, y que demuestre que no recibe costos, márgenes ni multiplicadores.

### P0-02 — Caja/POS no registra ventas

`src/modules/pos/usePosCart.ts` resuelve cualquier código creando un producto ficticio (`Producto <código>`) con precio fijo de 100 o 1500. `src/modules/pos/PosPage.tsx` al cobrar hace `console.log`, `alert` y vacía el carrito. No consulta catálogo, no abre/cierra turno, no crea venta, no encola operación offline, no invoca RPC, no descuenta FEFO ni registra movimiento de stock.

El payload local tampoco coincide con el esperado por el RPC: la UI usa `total`, `clientId`, `card`/`mixed`/`fiado`; el SQL posterior espera, entre otros, `totalAmount`, `customerId`, `shiftId` y métodos distintos.

**Salida exigida:** un flujo real de escaneo → carrito desde catálogo → cobro → evento offline idempotente → RPC atómico → venta, ítems, asignación FEFO y movimiento de stock; más pruebas online, offline y reintento duplicado.

### P0-03 — Clientes y cuenta corriente son datos simulados

`src/modules/customers/CustomersPage.tsx` inicializa Juan/María como `mockCustomers`. “Nuevo Cliente” no ejecuta ninguna acción y `CustomerCreditModal` solo modifica estado React. No hay lectura/escritura de Supabase, historial de crédito, límite, cola offline ni vínculo de una venta fiada con el cliente.

**Salida exigida:** CRUD de clientes y movimientos de crédito persistidos, autorizados y auditables; saldo derivable del historial, no solo mutable en memoria.

### P0-04 — Las migraciones de Fase 3 son incompatibles con el esquema canónico

La fundación ya crea `customers`, `sales` y `sale_items`. La migración `20260923020000_fase3_caja_ventas.sql` vuelve a declararlas con `CREATE TABLE IF NOT EXISTS`, pero con columnas incompatibles. Al existir las tablas, PostgreSQL no agrega `shift_id`, `total_amount`, `offline_local_id`, `created_at`, `subtotal`, `product_id`, `current_credit`, `status` o `updated_at`.

Luego, `20260923021000_fase3_rpc_offline_sales.sql` inserta precisamente varias de esas columnas ausentes. A su vez, `ReportsDashboard.tsx` requiere `sales.total_amount` y `sale_items.subtotal`; `SalesReports.tsx` filtra `status = 'completed'` cuando el enum fundacional usa `closed`/`voided`. Esto invalida POS, reportes y parte del backend aun antes de considerar la interfaz simulada.

**Salida exigida:** decidir un único contrato canónico, crear una migración correctiva incremental y comprobable (no otra tabla `IF NOT EXISTS`), y probar `supabase db reset` desde cero más actualización de un entorno con datos de prueba.

### P0-05 — RLS de Fase 3 anula la protección de datos de la fundación

La fundación restringe, por ejemplo, ventas e ítems a su propio vendedor o administradores. Fase 3 agrega políticas permisivas `USING (true)` / `WITH CHECK (true)` para `sales`, `sale_items`, `customers`, créditos y turnos. Las políticas permissive se combinan con OR, por lo que un usuario autenticado puede leer ventas ajenas y efectuar escrituras que la política anterior prohibía.

Además, `AppShell` solo verifica que exista una sesión; no separa rutas administrativas de empleado. Junto a esas políticas permisivas, este defecto deja de ser solo una mala experiencia de UI y se vuelve una falla de autorización.

**Salida exigida:** eliminar/reemplazar políticas abiertas, definir operaciones de escritura mediante RPCs autorizados y agregar pruebas de dos identidades (empleado A, empleado B, administrador) para lectura, inserción y actualización de cada tabla sensible.

### P0-06 — Fraccionamiento puede fallar dejando el inventario inconsistente

`FractioningModal.tsx` ejecuta cuatro inserciones/actualizaciones independientes desde el navegador. No hay transacción ni RPC. La migración de Fase 2 prohíbe más de un lote abierto por producto. El modal intenta crear el lote destino abierto antes de cerrar/actualizar el lote origen, por lo que puede chocar con el trigger; si cualquiera de los pasos posteriores falla, los movimientos ya insertados permanecen sin compensación.

La prueba actual comprueba únicamente el cálculo puro de cantidades, no la operación persistida, el trigger ni rollback.

**Salida exigida:** una RPC transaccional que bloquee los lotes afectados, aplique movimientos y cambios de stock en una sola transacción, y pruebas de éxito, error y concurrencia.

### P0-07 — No existe una línea de release trazable

El remoto no contiene las fases que el árbol local dice completar; el árbol local tiene 44 commits no publicados y seis archivos de implementación sin commit. No hay PR abierto para los cambios pendientes. Esto impide revisar, reproducir y aprobar una versión concreta.

**Salida exigida:** congelar la liberación, separar los cambios actuales en ramas/PR pequeños, y reconstruir la cadena de CI sobre el commit candidato. No se debe empujar este conjunto directo a `main`.

## Hallazgos altos (P1)

1. **Entradas de Caja/Clientes sin protección ni navegación.** `pos.html`, `customers.html` y sus entradas locales renderizan las páginas directamente, sin `AuthGate` ni `AppShell`; tampoco aparecen en la navegación. Además están sin commit. Deben incorporarse a rutas autenticadas y con autorización por rol.
2. **Pruebas con cobertura aparente, no funcional.** `integration.test.ts` contiene tres `expect(true).toBe(true)`. `src/integration.test.ts` solo ensaya el helper puro FEFO. `supabase/tests/smoke_test.sql` valida presencia de tablas/vista/RLS, no comportamientos ni permisos efectivos. No hay Playwright/Cypress ni tests reales de RPC.
3. **Reportes incorrectos.** Además de las columnas inexistentes, `ReportsDashboard` ignora errores de consultas y mezcla todo el dataset de ítems sin filtrar por período. `SalesReports` tiene valores visuales vacíos y no se monta desde Administración.
4. **Backup llamado “completo” pero incompleto y silencioso.** Hay dos implementaciones distintas. Una omite ventas, ítems, movimientos, auditoría, proveedores y configuración; otra convierte un error de lectura en una tabla vacía y aun así entrega un backup válido. Restaurar no cubre toda la operación. Esto no satisface una recuperación confiable.
5. **Ingreso rápido no es atómico.** `QuickRestock.tsx` crea un lote y luego intenta insertar el movimiento sin comprobar ese segundo error; puede mostrar éxito con lote sin trazabilidad. También fija `purchase_cost: 0`, degradando datos administrativos.
6. **Sincronización offline insuficientemente comprobada.** La cola IndexedDB tiene buena base, pero no hay Background Sync, backoff, indicador de fallo accionable ni prueba de recuperación de red. En cualquier caso, POS no la usa, por lo que hoy no hay venta offline.

## Hallazgos medios (P2)

- `BarcodeDashboard` ignora errores al actualizar códigos y anuncia éxito aun si hubo fallos o colisiones.
- `BarcodePdfService.exportToPdf` lanza “Not implemented”; no debe presentarse como funcional hasta que tenga implementación o se retire del alcance.
- Uso extenso de `any`, `alert` y `console` en caminos operativos; reduce diagnóstico, accesibilidad y mantenibilidad.
- El bundle administrativo incluye gráficos y supera ~460 kB sin compresión; con el hardware modesto indicado se requiere medición real y posible carga diferida, no una afirmación de rendimiento.

## Lo que sí queda acreditado

- El proyecto compila y TypeScript no informa errores.
- El helper FEFO y el generador/validador EAN-13 tienen pruebas unitarias que pasan.
- La cola IndexedDB dispone de pruebas unitarias y manejo de un mirror local.
- La dependencia de producción no reportó vulnerabilidades conocidas en `npm audit` al momento de la revisión.

Estos puntos son positivos, pero no compensan los bloqueantes de autorización, datos y operación de Caja.

## Plan obligatorio de recuperación y revalidación

1. **Congelar release y separar baseline.** No fusionar ni publicar los 44 commits locales como lote. Crear PRs por corrección y mantener el árbol limpio.
2. **Reconciliar esquema y seguridad primero.** Una migración correctiva versionada para contratos de ventas/clientes/lotes; retirar políticas abiertas; tests RLS y RPC con roles reales.
3. **Implementar el flujo operativo real.** Catálogo seguro para empleado; POS y clientes persistentes; páginas autenticadas/navegables; turno/caja y crédito definidos por contrato.
4. **Hacer transaccional el inventario.** POS, fraccionamiento, ajustes e ingresos deben registrar stock y cambios de lote de forma atómica y auditable.
5. **Rehacer reportes y backups sobre el esquema final.** Reportes con vistas/RPCs y filtros correctos; backup/restauración con inventario explícito, validación de integridad y tratamiento de errores que no silencie pérdidas.
6. **Agregar pruebas de aceptación.** `supabase db reset`; pruebas SQL de RLS, idempotencia, FEFO y rollback; E2E de login por rol, venta online/offline/reintento, fiado, fraccionamiento y restauración de backup. Ejecutarlas en CI y adjuntar resultados al PR.

## Condición de aprobación

La siguiente auditoría solo podrá aprobar una release candidate cuando los P0 estén resueltos en PRs revisables, las migraciones se apliquen desde cero, las pruebas de seguridad/datos/UI pasen y el commit candidato esté publicado y limpio. Hasta entonces, cualquier afirmación de “producción”, “100%” o “v1.0.0” es **no verificable y rechazada por QA/QC**.

