# Pendientes de la auditoría sitio ↔ base del 20/10/2026

Lista de trabajo para el próximo agente. Antes de empezar, leé `AGENTS.md`: un PR por problema, test que
falle si el defecto vuelve, pgTAP con roles reales si tocás SQL y nunca editar una migración existente.

Las referencias `archivo:línea` son de `main` al 20/10/2026, después de mergear #121, #122 y #123.
Si la línea cambió, buscá por el texto citado.

## 0. Contexto que conviene saber

- **La base de producción coincide con el repo.** Se comparó el catálogo completo del proyecto Supabase
  `Alverdesys` (`ivyozvynqlnucowrbury`): columnas, funciones (el código difiere sólo en finales de línea CRLF),
  permisos, políticas RLS, triggers, enums y vistas, contra una base armada con todas las migraciones. Coinciden,
  salvo los permisos de más que se listan en B-02.
- **Producción no registra migraciones.** La tabla `supabase_migrations.schema_migrations` está vacía: el SQL se
  aplicó a mano desde el editor. **Mergear un PR con SQL no cambia la base.** Hay que aplicar el archivo nuevo
  (editor SQL o `supabase db push`) y comprobarlo.
- **El proyecto se pausa solo.** En el plan gratuito Supabase pausa el proyecto tras una semana sin uso y el
  sitio deja de funcionar (no inicia sesión ni guarda). El 20/10/2026 estaba pausado y se reactivó.
- **Cómo probar sin Docker:** `npm run test:db:nodocker` levanta PostgreSQL local con todas las migraciones y
  privilegios como producción. Para impersonar roles, ver `supabase/tests/*.sql`. Para probar pantallas con
  clics hay `happy-dom` (ver `src/modules/admin/ProductsManager.test.tsx`). Nota: en happy-dom, un clic en un
  botón `submit` no envía el formulario; ver el helper de `src/modules/restock/QuickRestock.test.tsx`.

## 1. Ya resuelto en PR abiertos (no repetir)

| PR | Qué arregla | Falta |
|---|---|---|
| #124 | Ingreso rápido: con código de fabricante pide elegir la presentación (antes tomaba la más chica). | Merge |
| #125 | Código interno también para granel en ml y elaborados por unidad sin código de fabricante; la planilla de mostrador muestra errores. | Merge; después, en Administración → Códigos internos, «Generar los códigos que faltan» |
| #126 | Copia completa y CSV del respaldo leen todas las filas (antes se cortaban en 1000). | Merge |
| #127 | RF-38: el granel no admite faltante (decisión de la dueña); la caja avisa antes de cobrar. | Merge **y aplicar en producción** `supabase/migrations/20261020120000_rf38_granel_sin_faltante.sql` |

Ya mergeados: #121 (alta de producto con primera presentación, sin renombrar el anterior), #122 (sincronización
de lo encolado durante una pasada en curso) y #123 (precio de Balanza por kilo en la ficha).

## 2. Operativo (lo hace la dueña o quien administra)

- Agregar una presentación a «Arveja» y al primer «ketchup» (están sin presentación en producción: no aparecen
  en Caja ni en Stock) y cargarles stock con Ingreso rápido.
- Las presentaciones «ketchup 250g» y «mayonesa 500g» tienen «Cantidad base» = 10 en productos por unidad;
  parece que se cargó como stock. Revisar con la dueña (no afecta el conteo de stock).
- Activar en Supabase → Authentication la protección de contraseñas filtradas (asesor `auth_leaked_password_protection`).
- Decidir cómo evitar que el proyecto se pause (plan pago o uso periódico).
- Siguen vigentes los pendientes de `TAREAS.md` («Pendientes para declarar una versión lista»): registro abierto,
  proteger `main`, SQL de seguridad, planilla manual.

## 3. Defectos de uso diario (prioridad alta)

### A-01. Vencimientos un día antes en Argentina
- `src/modules/stock/expiry.ts:42`: `new Date(effectiveExpiryDate)` con `"YYYY-MM-DD"` se interpreta en UTC.
- Efecto: con `TZ=America/Argentina/Buenos_Aires`, un lote que vence hoy da -1 día (se ve «vencido») y uno que
  vence mañana da 0.
- Arreglo: construir la fecha local con `new Date(y, m - 1, d)`. Test con `TZ` de Buenos Aires.

### A-02. «Fraccionar» en una bolsa sin abrir habiendo otra abierta, y el rechazo se reintenta para siempre
- `src/modules/stock/StockLotsTable.tsx:40`: se ofrece «Fraccionar» en cualquier lote de Balanza no cerrado,
  aunque no esté abierto y ya haya otra bolsa abierta.
- La base lo rechaza con `P0001` («Regla de oro del granel…», `20261010010000_sucursales_stock.sql:226`).
- `src/shared/offline/sync.ts:19`: `isPermanentSyncError` trata `P0001`/`P0002` como pasajeros: la operación
  se reintenta sin fin, nunca aparece como «requiere atención» y la vista local la muestra como hecha.
- Arreglo: en `lotActions` exigir `lot.opened_at || !hasActiveBag`; tratar como rechazo permanente los
  `P0001`/`P0002` de reglas de negocio (o que las RPC usen códigos 22/23).

### A-03. Fraccionamiento rechazado si la bolsa vendió algo después de abrir la pantalla
- `src/modules/fractioning/FractioningModal.tsx:163` manda `newOriginQuantity` calculado con la cantidad que
  había en pantalla; el servidor exige igualdad exacta (`20261010010000_sucursales_stock.sql:677`, `22023`
  «El remanente o la merma no coinciden…»). Es rechazo permanente.
- Arreglo: con estado `open`, que el servidor calcule el remanente con la cantidad actual del lote.

### A-04. Turno abierto sin conexión que la base rechaza: el error se oculta
- El paso previo que crea el turno en la nube (`src/modules/pos/shift.ts`, `persistShift`) falla con `23505`
  (caja ocupada) o `42501` (otra sucursal) y sólo se registra con `console.warn` (`src/shared/offline/sync.ts:90`).
- Las ventas de ese turno reciben `P0002` y se reintentan sin fin; al cerrar, `shift.ts:159` dice «Para cerrar
  el turno hace falta conexión» aunque haya red.
- Arreglo: guardar el error en el turno local y mostrarlo en Caja y al cerrar.

### A-05. Anular una venta de granel falla si esa venta vació la bolsa y después se abrió la siguiente
- `supabase/migrations/20261009120000_anular_venta_completa.sql:41` devuelve el stock a la bolsa vieja y choca
  con la regla de una sola bolsa abierta (`20261010010000_sucursales_stock.sql:226`).
- Arreglo (migración nueva): devolver a la bolsa abierta vigente, o dar por terminada la vieja antes de devolver.

### A-06. La caja vacía el carrito después de guardar la venta
- `src/modules/pos/PosPage.tsx:270`: `dispatch({ type: "clear" })` corre después del `await` de la cola; un
  producto escaneado en esa espera se borra sin venderse. Sospechoso, no reproducido en navegador.

## 4. Base de datos (cada uno, migración nueva con pgTAP)

### B-01. Auditoría de productos duplicada
- Dos triggers sobre `products`: `products_audit` (`20260922060000_phase_0_foundation.sql:338`, entidad
  `'product'`) y `trg_audit_products` (`20260923000001_fase1_faltantes_auditoria.sql:100`, entidad `'products'`).
- Confirmado en producción: crear un producto deja ~12 filas `'product'` (incluidos `id`, `created_at`,
  `updated_at`) y cada cambio queda dos veces. `audit_history_search` devuelve `entity_label` NULL para
  `'product'`, la búsqueda por texto no las encuentra y llenan el límite de 200 del historial.
- Arreglo: borrar `products_audit` y mapear o limpiar las filas `'product'`.

### B-02. Permisos de más en producción
- `authenticated` tiene `TRUNCATE`, `TRIGGER` y `REFERENCES` sobre `cash_shifts`, `missing_items` y
  `stock_warnings` en producción (no en el repo). PostgREST no expone TRUNCATE, pero conviene revocarlos con
  una migración idempotente (`revoke truncate, trigger, references on … from authenticated`).

### B-03. Faltantes duplicados por venta sin lotes
- `20261010100000_actualiza_comentario_rf38_venta.sql:234` (y su copia en #127): cada venta de un producto sin
  lotes crea un `missing_items` nuevo, sin la regla «uno abierto por producto y sucursal» de
  `apply_offline_operation`.

### B-04. Bloqueo mutuo entre dos ventas simultáneas con varios productos
- La venta bloquea lotes producto por producto (`for update of sl`, `20261010100000…:200`) antes de tomar el
  lock global `stock-floor:global` (`20261010090000…:68`). Reproducido: ventas [c1, c3, c2] y [c2, c1] →
  `deadlock detected`. El frontend reintenta; la venta llega tarde pero no se pierde.
- Arreglo: tomar el lock global al inicio de la RPC (y de la anulación), o bloquear lotes en orden fijo.

### B-05. Reglas de stock que conviene confirmar con la dueña
- `missing_items`: la política de lectura deja a un empleado ver faltantes de todas las sucursales.
- `stock_lots`: la política `admins manage lots` (ALL) permite escrituras directas desde el navegador, contra
  el contrato de AGENTS.md (stock por RPC).
- Al cerrar una bolsa en el fraccionamiento, el remanente queda como `current_quantity > 0` en un lote cerrado
  y la venta lo sigue descontando (el FEFO no filtra por estado).

### B-06. Asesores de Supabase (rendimiento y seguridad menor)
- 38 claves foráneas sin índice (entre ellas `product_presentations.product_id`, `sale_items.sale_id`,
  `stock_lots.presentation_id`); índice duplicado en `supplier_products`
  (`one_primary_supplier_per_product` y `supplier_products_one_primary_per_product_idx`); `profiles` y
  `stock_movements` reevalúan `auth.uid()` por fila; `effective_expiry_date` sin `search_path` fijo.

## 5. Listas y reportes

### C-01. Consultas cortadas en 1000 filas sin aviso (`max_rows` de Supabase)
Sin paginar (usar el patrón `fetchAllRows` de #126 o paginar en pantalla):
- `src/modules/reports/ReportsDashboard.tsx:38` (`sale_items` del rango): totales y rankings de 30/90 días.
- `src/modules/reports/MarginDashboard.tsx:32` y `:42`.
- `src/modules/catalog/useCatalog.ts:40` (`employee_catalog`, una fila por presentación): a la Caja, al
  Catálogo y a la copia sin conexión les faltan productos.
- `src/modules/stock/useStockLots.ts:81` (incluye lotes cerrados: filtrar `status = 'open'` por defecto).
- `src/modules/customers/api.ts:33`, `src/modules/admin/ProductsManager.tsx:46`,
  `src/modules/admin/BulkAssignPanel.tsx:27`, `src/modules/fractioning/ShelfLifeManager.tsx:32`.
- Sospechoso: `bulk_update_prices` devuelve una fila por cambio; con más de 1000 la vista previa se cortaría.

### C-02. CSV del respaldo no abre bien en Excel en español
- `src/shared/backup/export.ts:72` (`jsonToCSV`): coma como separador y sin BOM. `src/shared/export/excel.ts`
  ya usa `;` y BOM.

### C-03. Precio de Balanza mostrado por gramo
- `src/modules/catalog/exportCatalog.ts:25`: el Excel del catálogo exporta el precio por gramo (la tarjeta
  muestra por kilo). Rompe RF-05 («coincide con lo que se ve en pantalla»).
- `src/modules/admin/ProductPricing.tsx:199`: «Precio actual» muestra por gramo al lado del sugerido por kilo.

## 6. Administración

### D-01. Sucursales y cajas: los errores se borran solos
- `src/modules/admin/BranchesManager.tsx`: `run()` muestra el error y enseguida `load()` hace
  `setError(null)` (línea 31). Reproducido: una «Caja 1» duplicada da `23505` y no se ve ningún mensaje.
- Mismo archivo, línea 157: «Sin asignar (X)» usa `branches[0]` (orden alfabético) y la base usa la sucursal
  más antigua (`default_branch_id()`).

### D-02. Marcas y rubros archivados en la ficha de producto
- `src/modules/admin/ProductsManager.tsx:47-48` los carga sin filtrar `archived_at`; se puede asignar una marca
  archivada (incluidas las que `merge_classifier` archivó al unir).

### D-03. Nombres únicos y archivado
- `brands`, `labels` y `suppliers` tienen `unique (name)` que incluye archivados y no hay pantalla para
  desarchivar: archivar «bloquea» el nombre y el error llega en inglés.
- `categories` tiene `unique (parent_id, name)`: con `parent_id` NULL se pueden duplicar rubros principales.
- La unicidad distingue mayúsculas («Arcor» y «arcor»).

### D-04. Errores de consultas ignorados
- `src/modules/admin/BulkPriceUpdate.tsx:43-51`, `src/modules/audit/AuditHistoryPage.tsx:30`,
  `src/modules/catalog/useCatalog.ts:41-43` desestructuran `data` sin mirar `error`.

### D-05. Anular venta escribe directo en la tabla
- `src/modules/reports/SalesHistory.tsx:48`: `update sales set status='voided'` desde el navegador
  (AGENTS.md pide RPC) y un UPDATE de 0 filas se toma como anulación exitosa.

## 7. Stock, caja y varios (prioridad media o baja)

- **E-01.** `src/modules/stock/transfer.ts:19`: `Math.round(q*1000) !== q*1000` rechaza cantidades válidas de
  3 decimales por redondeo flotante (ej. `1.005`). Validar el texto con `/^\d+(\.\d{1,3})?$/`.
- **E-02.** `src/modules/stock/StockAdjustmentModal.tsx:53`: no valida más de 3 decimales; se encola y la base
  lo rechaza para siempre (`22023`).
- **E-03.** Fiado a un cliente dado de alta sin conexión: si el alta falla de forma pasajera, la venta recibe
  `23503` y queda rechazada hasta el cierre.
- **E-04.** `src/modules/pos/shift.ts:81-92`: `findOwnOpenShift` ignora el error de la consulta; puede terminar
  en «turno de otra persona» siendo propio.
- **E-05.** `src/modules/pos/PosPage.tsx:98`: `confirm()` asigna la caja sin `try/catch`; `:588`:
  `shiftSummary(shift).then(setSummary)` sin `catch`.
- **E-06.** `src/shared/offline/registerServiceWorker.ts:10` y `:13`: `console.log` de depuración (AGENTS.md lo
  prohíbe).
- **E-07.** `src/modules/barcodes/BarcodeDashboard.tsx:35`: el probador de lector decide «pide peso» por
  `base_unit === "gram"` en vez de `sold_by_weight` (ya listado en `TAREAS.md`).
- **E-08.** Ingreso rápido: «Cantidad a ingresar» no muestra la unidad; en granel el «1» por defecto es 1 gramo.
- **E-09.** Modales de fraccionamiento y ajuste: `pendingFeedbackId` no se limpia al reabrir; al sincronizar la
  operación anterior, `onClose()` puede cerrar el modal de otro lote (sospechoso, leído en el código).
- **E-10.** `get_next_internal_code_seq` la ejecuta cualquier autenticado (sólo consume números).
- **E-11.** `src/modules/admin/ProductsManager.tsx`: si se cambia rápido de producto, las presentaciones del
  anterior pueden llegar tarde y mostrarse bajo el nuevo (sospechoso).
- **E-12.** `sync_offline_customer` hace `ON CONFLICT DO NOTHING`: si el alta ya llegó a la nube pero no se marcó
  sincronizada, corregir el tope después no se aplica ni avisa (sospechoso).
- **E-13.** Filtrar el catálogo por un rubro padre no incluye sus subrubros (`useCatalog.ts`, depende de RF-04).
- **E-14.** `src/shared/export/excel.ts`: `revokeObjectURL` inmediatamente después del `click` sin agregar el
  enlace al DOM; podría fallar en Safari/iOS (no probado).
- **E-15.** `ScalePresentations.tsx` y `MarginDashboard.tsx` incluyen productos archivados.

## 8. Cómo se encontró

- Comparación de catálogo producción ↔ migraciones (consultas en el PR de este documento y en #121).
- Revisión de cada llamada `from()`/`rpc()` del sitio contra tablas, columnas, permisos y RLS, ejercitándolas
  en la base local con empleado, otro empleado, administradora y `anon` dentro de `BEGIN … ROLLBACK`.
- Datos y auditoría de producción (`audit_history`, `offline_operations`, lotes) consultados en modo lectura.
- Lo marcado «sospechoso» no se reprodujo: confirmarlo antes de arreglar.
