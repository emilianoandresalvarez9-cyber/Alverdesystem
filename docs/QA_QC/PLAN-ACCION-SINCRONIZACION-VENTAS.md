# QA/QC · Plan de acción: sincronización de ventas

**Estado:** hallazgos de código confirmados; causa del incidente todavía sin confirmar.  
**Alcance:** diagnóstico y criterios para que QA/QC implemente las mejoras en PRs separados.  
**Prioridad:** alta: una venta puede permanecer en el dispositivo sin que la caja explique por qué.

> Este documento es un traspaso de trabajo, no una certificación. No afirma que la venta de la captura se haya perdido ni determina por qué falló su sincronización.

## Evidencia disponible

- En la captura de Caja se veía `Conectado · 2 operaciones pendientes` y el carrito vacío.
- En la captura de Supabase, la tabla `sales` aparecía vacía.
- El código inspeccionado muestra que la Caja guarda primero la operación en IndexedDB, vacía el carrito y luego intenta sincronizar en segundo plano.
- El contador de pendientes cuenta todas las clases de operación de la cola, no solo ventas. Esas dos operaciones podrían incluir ventas, movimientos, clientes o faltantes.
- No se confirmó si la app abierta apunta al mismo proyecto Supabase que se estaba inspeccionando. Tampoco se obtuvo el error de la RPC `process_offline_sale`.

**Conclusión acotada:** al momento de la captura no había una venta visible en la tabla `sales` del proyecto observado. La captura no permite concluir si la cola contiene esa venta ni cuál fue el error remoto.

## Hallazgos reproducibles en el código

| Hallazgo | Evidencia | Efecto para Caja |
|---|---|---|
| El indicador confunde conectividad del navegador con sincronización del backend. | `src/shared/components/OfflineIndicator.tsx` usa `navigator.onLine` y `pendingOperationCount()`. | Puede mostrar `Conectado` mientras el servidor rechaza o no recibe las operaciones. |
| Los errores devueltos por Supabase se guardan en la operación, pero no se muestran en Caja. | `src/shared/offline/sync.ts` llama `markOperationFailed(...)`; `src/shared/offline/queue.ts` persiste `failureMessage`; `OfflineIndicator.tsx` solo lee el contador. | La persona no puede distinguir autenticación, RPC, turno u otro rechazo. |
| Una excepción lanzada por la llamada RPC sale por el `catch` externo. | `src/shared/offline/sync.ts`: el `catch` externo limpia `inFlight` y relanza; el backoff se programa en la rama de resultado normal. | Si `rpc()` rechaza en vez de devolver `{ error }`, no se programa ese reintento y no se guarda `failureMessage` de esa operación. |
| El carrito se vacía antes de que termine la sincronización remota. | `src/modules/pos/PosPage.tsx`: `enqueueOperation`, `dispatch(clear)` y después `synchronizePendingOperations()`. | La venta puede dejar de verse en el carrito mientras aún espera confirmación del servidor. La operación sí debe seguir protegida en IndexedDB. |
| La prueba E2E valida solo el guardado local. | `e2e/sale.spec.ts` espera el texto `Venta guardada` y luego busca la operación en IndexedDB; no consulta `sales` ni exige que la cola drene. | El E2E puede pasar aunque la sincronización remota esté rota. |

## Trabajo propuesto para QA/QC

Cada bloque debe resolverse en un PR independiente hacia `main`, con evidencia de los comandos, la prueba manual y la salida real del CI.

### QA-SYNC-01 · Exponer estado y error de sincronización — P0

- Separar los estados **sin conexión**, **sincronizando**, **sincronizado** y **falló / pendiente de reintento**. `navigator.onLine` debe describir solo la conexión del navegador.
- Mostrar cuántas operaciones están pendientes, sus tipos y la hora de creación; dejar claro que el contador no equivale al número de ventas.
- Mostrar el motivo de fallo almacenado de forma legible y una acción para reintentar la misma operación con el mismo `localId`.
- No mostrar claves, tokens ni encabezados de autorización en el diagnóstico.

**Aceptación:** se puede identificar en Caja qué operación falló y por qué; no hace falta abrir DevTools para conocer el error común. El reintento no crea un `localId` nuevo.

### QA-SYNC-02 · Hacer resiliente el ciclo de reintentos — P0

- Tratar tanto el resultado `{ error }` de Supabase como las excepciones de red/configuración.
- Registrar el fallo de forma segura y programar backoff en ambos casos; no dejar `inFlight` atascado.
- Mantener cada evento en IndexedDB hasta confirmación exitosa. No marcarlo sincronizado antes de que la RPC lo confirme.
- Mantener la idempotencia del backend al reintentar el mismo evento.

**Aceptación:** con una respuesta de error y con un `rpc()` que rechaza, la operación continúa en cola, Caja informa que sigue pendiente y un reintento posterior puede sincronizarla sin duplicarla.

### QA-SYNC-03 · Hacer que E2E compruebe persistencia remota — P0

- Extender el flujo de `e2e/sale.spec.ts` para comprobar que `process_offline_sale` finaliza con éxito.
- Verificar que la venta aparece una sola vez en `sales` usando su `localId` y que la operación local obtiene `syncedAt` / sale del contador de pendientes.
- Añadir un escenario sin conexión seguido de reconexión; comprobar que la misma operación termina en la base y no se duplica.
- Añadir al menos un escenario de rechazo RPC o fallo de red donde la venta siga en la cola y la interfaz muestre el estado pendiente.

**Aceptación:** la prueba falla si solo se guarda en IndexedDB y nunca llega a `sales`. La repetición del mismo `localId` deja exactamente una venta.

### QA-SYNC-04 · Aclarar la confirmación de cobro — P1

- Diferenciar el mensaje de “guardada en este dispositivo” del de “sincronizada con el servidor”.
- Si el dispositivo está offline o la RPC falla, indicar que la venta sigue pendiente y que se conserva localmente.
- No restaurar automáticamente el carrito ni invitar a crear otra venta para resolver el fallo; eso puede originar duplicados.

**Aceptación:** la interfaz nunca comunica que la venta llegó a Supabase antes de recibir confirmación. La persona puede seguir viendo el estado pendiente y el carrito vacío no implica pérdida de la operación.

## Procedimiento de diagnóstico del incidente

1. **No borrar almacenamiento del sitio ni eliminar operaciones de IndexedDB.** No volver a cobrar como una venta nueva mientras la original siga pendiente.
2. Registrar el dominio de la app y comparar el identificador público del proyecto en `VITE_SUPABASE_URL` con el proyecto de Supabase abierto. No copiar ni compartir la clave anon ni encabezados.
3. Inspeccionar la respuesta de `rpc/process_offline_sale` en Network o en los logs de API de Supabase para la hora del intento. Registrar código HTTP y cuerpo del error, sin tokens.
4. Determinar desde la cola local si las dos operaciones pendientes son ventas u otras clases y anotar su `failureMessage`/fecha, sin editar ni borrar sus `localId`.
5. Reintentar únicamente las operaciones ya encoladas después de identificar el destino correcto y el motivo del fallo. Verificar `sales` por `localId` para evitar duplicados.

## Qué no se sabe todavía

- Si la app y el dashboard apuntaban al mismo proyecto Supabase.
- Si el intento generó una operación `sale` o si las dos pendientes eran de otro tipo.
- El código y cuerpo de la respuesta de `process_offline_sale`.
- Si el turno estaba persistido y asociado a la caja/usuario correctos en el proyecto que recibió la solicitud.

No cambiar ni borrar una migración histórica para este trabajo. Si QA/QC descubre un problema de esquema o RLS, debe crear una migración nueva y pruebas pgTAP por rol, además del PR correspondiente.
