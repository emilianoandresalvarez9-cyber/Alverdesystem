# Estado y tareas pendientes — Alverde System

> Corte de revisión: 10 de octubre de 2026, rama `main`, commit `f5f069d`.
> Revisión requisito por requisito contra el código (no contra la planilla manual, que sigue sin firmar).
> Estado de avance: en desarrollo, pendiente de QA manual. No equivale a aprobación ni a aptitud para producción.

## Cómo leer esta página

- **Código + test**: existe en el repositorio y hay al menos un test automático (Vitest, pgTAP o Playwright) que falla si se rompe. No significa aceptado: falta la validación manual.
- **Parcial**: existe pero no como el requisito lo describe; se indica qué falta.
- **Operativo**: no es código; lo hace la dueña o quien despliegue.
- Columna PR: dónde entró el último cambio relevante.

## Matriz RF

| RF | Estado | Detalle / PR |
|---|---|---|
| RF-01 a RF-02, RF-04 a RF-06 | Código + test | Catálogo, tres ejes, filtros combinables, exportación a Excel, marca "Del local". El buscador también encuentra por marca desde #100. |
| RF-03 | Código + test | Crear, renombrar, archivar; **unir** y **asignar en bloque** desde #85. «Unir con…» confirma en un diálogo con los dos nombres desde #104 (antes, `window.confirm`). |
| RF-07 a RF-10 | Código + test | Lotes con vencimiento efectivo, FEFO, listado ordenable. |
| RF-11 a RF-17b | Código + test | Granel, una bolsa abierta (trigger), fraccionamiento con merma, vida útil individual y en bloque. |
| RF-18 a RF-23 | Código + test | Lector como teclado, EAN del fabricante, EAN-13 interno (20–29), planilla de mostrador, sin precio en la etiqueta. |
| RF-24 a RF-26, RF-29 | Código + test | Varios proveedores con principal, costo por unidad de compra, multiplicador por rubro/producto, margen solo administrador, redondeo a $100 del sugerido. La pantalla de Márgenes (RF-26) existía pero no se podía abrir: tiene sección propia desde #103. |
| RF-27 | Código + test | Historial de precios guardado por trigger y **visible por producto** desde #87. |
| RF-28 | Código + test | Masiva por porcentaje, por marca, rubro o **proveedor**, con **vista previa** y aplicación atómica por RPC (#82). En balanza redondea el precio por kilo desde #94. Decisión a confirmar con la dueña: redondeo a $100 activado por defecto. |
| RF-30 | Código + test | Lista de reetiquetado por lote de actualización, exportable (#82). |
| RF-31 a RF-33c | Código + test | Caja, cierre por medio de pago, peso manual, interfaz de báscula, imagen del código. |
| RF-34, RF-35, RF-37, RF-39, RF-40 | Código + test | Caché sin costos, cola con `localId`, solo-agregar, precios anteriores sin conexión, segunda copia en carpeta local. Anular una venta pide confirmación desde #103 (antes la anulaba un solo toque). |
| RF-36 | Código + test | Indicador en todas las páginas desde #88. |
| RF-38 | Código + test | La venta no se bloquea y queda marcada; **pantalla de revisión** para administradora desde #83. |
| RF-41, RF-43 | Código + test | Respaldo al cerrar turno; exportación de cualquier tabla. |
| RF-42 | Parcial (por diseño) | La segunda copia va a la carpeta que elija la dueña (puede ser la de Google Drive). No sube sola a Drive. |
| RF-44 | Operativo, pendiente | Ensayo de restauración completa: no se hizo. Runbook en `docs/runbooks/restaurar-base.md`. |
| RF-45 a RF-48 | Código + test | Clientes, fiado como cargos/abonos sin conexión, tope manual, ajuste solo administrador. |
| RF-49 a RF-51 | Código + test | Faltantes desde el celular, lista por proveedor, ingreso rápido. |
| RF-52 | Operativo, pendiente | Conteo físico inicial. |
| RF-53 a RF-56 | Código + test | Sucursal/caja/rol desde el día uno; nube como fuente única; archivar en vez de borrar. |
| RF-57, RF-58 | Código + test | Movimientos con motivo; auditoría por trigger. |
| RF-59 | Parcial | Cada administradora tiene su cuenta y el historial distingue quién hizo cada cambio. Las cuentas se crean desde el panel de Supabase: no hay pantalla de usuarios (requeriría una función de servidor con clave de servicio). |
| RF-60 | Código + test | Historial con **búsqueda por producto, persona y fecha** y valores legibles desde #84. |
| RF-61, RF-62, RF-64 | Código + test | Ventas por día, ranking por cantidad e importe, solo administrador. |
| RF-63 | Código + test | Demanda por rubro y **por etiqueta** desde #86. |
| RF-65, RF-66, RF-70 | Código + test | Stock por sucursal, sucursal de trabajo (el empleado, fija en la suya) y faltantes, stock negativo y reportes por sucursal (#91, #92). pgTAP: `sucursales_test.sql`, `sucursales_stock_test.sql`. |
| RF-67 | Parcial | La pantalla «Sucursales y cajas» asigna la sucursal de cada usuario (#92, rediseño en #104). Falta un pgTAP que pruebe quién puede cambiar `profiles.branch_id`: los tests actuales la fijan como superusuario. |
| RF-68 | Código + test | Traspasos entre sucursales, solo administración, en una sola operación (#93). pgTAP: `rf68_traspasos_test.sql`. |
| RF-69 | Código + test | Precio base y precio propio opcional por sucursal; caja, catálogo, masiva e historial lo respetan (#96). pgTAP: `rf69_precio_por_sucursal_test.sql`. |

## Matriz RNF

| RNF | Estado | Detalle |
|---|---|---|
| RNF-01 | Parcial (límite físico) | Sin internet: sí (PWA + cola). Sin luz: una aplicación en navegador no puede operar; acordar con la dueña (UPS o celular). |
| RNF-02, RNF-03 | Código, sin medición | Falta registrar tiempos en la notebook de caja y en celulares reales (planilla manual). |
| RNF-04 | Código + test | Vistas de empleado sin costos; pgTAP con rol empleado en cada RPC. En #101 se sacó de Stock un texto que veía el empleado y hablaba de costos y márgenes. Falta la revisión visual con rol Empleado en los dos temas. |
| RNF-05, RNF-09, RNF-10 | Código | Supabase + React, módulos por responsabilidad, `.env` fuera del repo. |
| RNF-06 | Código + test, sin QA visual | Sistema de diseño de Claude Design en todas las páginas: base (#98), Caja (#99), Catálogo (#100), Stock (#101), Clientes (#102), Administración (#103, #104) e Ingreso (#105). Sin estilos del marcado anterior. Tests: `tests/theme/*` (tokens, componentes, hojas por página, pantallas de Administración, Ingreso). Falta recorrerlo en la notebook de caja y en celulares. |
| RNF-07, RNF-08 | Código + test | View Transitions entre documentos con bloques separados (#81, #98); entre secciones de Administración desde #103. |

## Pendientes para declarar una versión lista

1. Completar y firmar la [planilla de validación manual](docs/PLANILLA_VALIDACION_MANUAL.md) en entorno real. Incluye las pantallas de #82 a #88, las de sucursales (#92, #93, #96) y todo el rediseño (#98 a #105): se probaron con pgTAP, Vitest, Playwright en el CI y un *preview* con datos simulados, no contra la base real.
2. Validar el hardware: lector de códigos y balanza. Probar en la notebook de caja con Edge y en celulares; registrar tiempos (RNF-02, RNF-03).
3. Ensayar una restauración completa (RF-44) con una base de prueba.
4. Hacer el conteo físico inicial (RF-52).
5. Alta de usuarios (RF-59): hoy se crean desde el panel de Supabase.
6. Proteger `main` en GitHub (requerir PR y los checks `frontend`, `database`, `database-strict`, `migrations` y `e2e`). Cloudflare Pages despliega cada merge sin esperar al CI.
7. Confirmar con la dueña: redondeo a $100 en la masiva (RF-28), continuidad ante corte de luz (RNF-01), tema por defecto.
8. pgTAP de RF-67 (quién puede asignar la sucursal de un usuario).

## Otros pendientes vistos (un PR cada uno)

- Stock: el aviso «Sin conexión» aparece aunque el error de carga sea otro. Se arregla como en Clientes, con un estado de error de carga separado (`accountsLoadError` en `src/modules/customers/api.ts`).
- Margen y precio sugerido por sucursal: seguimiento de RF-69. Puede necesitar backend.
- El probador del lector (Códigos y planilla) dice «ingresá el peso en gramos» al encontrar un granel, aunque ahí no se pide peso.
- `scripts/migrate-global-css.mjs`: script viejo de una sola vez que nombra variables CSS que ya no existen. No corre en el build ni en el CI; se puede borrar.

## Defectos encontrados y corregidos en el rediseño (#98 a #105)

- Márgenes (RF-26) no se podía abrir desde ninguna pestaña (#103).
- Anular una venta (RF-37) no pedía confirmación (#103).
- Las fuentes autoalojadas nunca se cargaban (#98).
- Un vencimiento se mostraba un día antes por la zona horaria (#101).
- Las ventas después de las 21 h caían en el día siguiente en Reportes: se agrupaban por fecha UTC (#103).
- El buscador decía buscar por marca y no lo hacía (#100).
- Un texto de Stock que veía el empleado hablaba de costos y márgenes (RNF-04, #101).
- Reportes cargaba recharts (~400 kB): `admin.js` bajó de 501 a 103 kB y lo que guarda el modo sin conexión, de 1075 a 837 KiB (#103).
- «Unir con…» usaba `window.confirm` (#104).
- En Clientes, «Crear cliente» se podía tocar sin conexión (#102).
- Al imprimir la planilla de mostrador salían la navegación de Administración y las pestañas (#104).

## Evidencia automática observada

CI de `main` en el commit `f5f069d` (merge de #105): [run 38023218822](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/actions/runs/38023218822), `success`, con los jobs `frontend`, `database`, `database-strict`, `migrations` y `e2e`. Suite al corte: 414 aserciones pgTAP en 28 archivos (`supabase test db` y el arnés estricto), 305 Vitest en 51 archivos, Playwright `auth.spec.ts`, `sale.spec.ts` y `employee-stock-operations.spec.ts` contra Supabase local en el job `e2e`.

**Permisos como producción:** #95 (GRANT explícito en `stock_warnings`, `missing_items` y `cash_shifts`) y #97 (EXECUTE explícito en `is_api_role` y `credit_movement_delta`) corrigieron «permission denied» que en producción aparecían y en las pruebas no. Desde entonces el job `database-strict` corre las migraciones y los pgTAP con el arnés de `qa/pg-harness/` (`npm run test:db:nodocker`), sin los privilegios automáticos de Supabase. Tienen que pasar `database` y `database-strict`.

## Registro de cambios de avance

- 2026-10-10: #91–#93 y #96 (varias sucursales, RF-65 a RF-70), #94 (masiva por kilo en balanza), #95 y #97 (permisos explícitos y job `database-strict`), #98–#105 (RNF-06: sistema de diseño en todas las páginas).
- 2026-10-09: PRs #73–#78 (anular venta completa, e2e solo local, arnés sin Docker, respaldos sin restauración desde el navegador, cliente tipado, una sola balanza), #72/#79/#80/#81 (RNF-06 parte 1), #82–#88 (RF-28, RF-30, RF-38, RF-60, RF-03, RF-63, RF-27, RF-36).
- 2026-09-30: corte anterior (77 % estimado; se reemplaza por la matriz de arriba).

Actualizar esta página cuando una tarea cambie de estado, indicando evidencia (PR/commit, CI o planilla). No marcar "completo" por la sola presencia de componentes en el código.
