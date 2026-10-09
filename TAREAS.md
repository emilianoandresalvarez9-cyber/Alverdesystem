# Estado y tareas pendientes — Alverde System

> Corte de revisión: 9 de octubre de 2026, rama `main`, commit `fa5db89`.
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
| RF-01 a RF-02, RF-04 a RF-06 | Código + test | Catálogo, tres ejes, filtros combinables, exportación a Excel, marca "Del local". |
| RF-03 | Código + test | Crear, renombrar, archivar; **unir** y **asignar en bloque** desde #85. |
| RF-07 a RF-10 | Código + test | Lotes con vencimiento efectivo, FEFO, listado ordenable. |
| RF-11 a RF-17b | Código + test | Granel, una bolsa abierta (trigger), fraccionamiento con merma, vida útil individual y en bloque. |
| RF-18 a RF-23 | Código + test | Lector como teclado, EAN del fabricante, EAN-13 interno (20–29), planilla de mostrador, sin precio en la etiqueta. |
| RF-24 a RF-26, RF-29 | Código + test | Varios proveedores con principal, costo por unidad de compra, multiplicador por rubro/producto, margen solo administrador, redondeo a $100 del sugerido. |
| RF-27 | Código + test | Historial de precios guardado por trigger y **visible por producto** desde #87. |
| RF-28 | Código + test | Masiva por porcentaje, por marca, rubro o **proveedor**, con **vista previa** y aplicación atómica por RPC (#82). Decisión a confirmar con la dueña: redondeo a $100 activado por defecto. |
| RF-30 | Código + test | Lista de reetiquetado por lote de actualización, exportable (#82). |
| RF-31 a RF-33c | Código + test | Caja, cierre por medio de pago, peso manual, interfaz de báscula, imagen del código. |
| RF-34, RF-35, RF-37, RF-39, RF-40 | Código + test | Caché sin costos, cola con `localId`, solo-agregar, precios anteriores sin conexión, segunda copia en carpeta local. |
| RF-36 | Código + test | Indicador en todas las páginas desde #88 (pendiente de merge al corte). |
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

## Matriz RNF

| RNF | Estado | Detalle |
|---|---|---|
| RNF-01 | Parcial (límite físico) | Sin internet: sí (PWA + cola). Sin luz: una aplicación en navegador no puede operar; acordar con la dueña (UPS o celular). |
| RNF-02, RNF-03 | Código, sin medición | Falta registrar tiempos en la notebook de caja y en celulares reales (planilla manual). |
| RNF-04 | Código + test | Vistas de empleado sin costos; pgTAP con rol empleado en cada RPC. |
| RNF-05, RNF-09, RNF-10 | Código | Supabase + React, módulos por responsabilidad, `.env` fuera del repo. |
| RNF-06 | En curso | Tokens y selector (#72), Caja (#79/#80), barra lateral y login (#81). Faltan catálogo, stock, clientes, administración y login completo. |
| RNF-07, RNF-08 | Código + test | View Transitions entre documentos con bloques separados (#81). |

## Pendientes para declarar una versión lista

1. Completar y firmar la [planilla de validación manual](docs/PLANILLA_VALIDACION_MANUAL.md) en entorno real, incluyendo las pantallas nuevas (#82 a #88): ninguna se probó en navegador contra una base real, solo con pgTAP y Vitest.
2. Probar en la notebook de caja con Edge y en celulares; registrar tiempos (RNF-02).
3. Ensayar una restauración completa (RF-44) con una base de prueba.
4. Confirmar con la dueña: redondeo a $100 en la masiva (RF-28), continuidad ante corte de luz (RNF-01), tema por defecto (claro desde #72).
5. Proteger `main` en GitHub (requerir PR y los cuatro checks). Cloudflare Pages despliega cada merge sin esperar al CI.
6. Terminar RNF-06 (páginas restantes).

## Evidencia automática observada

CI de `main` en el commit `abafc74` (último completado al corte): [run 38006285482](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/actions/runs/38006285482), `success`. Suite al corte: 313 pruebas pgTAP, 126 Vitest, Playwright `sale.spec.ts` contra Supabase local en el job `e2e`.

## Registro de cambios de avance

- 2026-10-09: PRs #73–#78 (anular venta completa, e2e solo local, arnés sin Docker, respaldos sin restauración desde el navegador, cliente tipado, una sola balanza), #72/#79/#80/#81 (RNF-06 parte 1), #82–#88 (RF-28, RF-30, RF-38, RF-60, RF-03, RF-63, RF-27, RF-36).
- 2026-09-30: corte anterior (77 % estimado; se reemplaza por la matriz de arriba).

Actualizar esta página cuando una tarea cambie de estado, indicando evidencia (PR/commit, CI o planilla). No marcar "completo" por la sola presencia de componentes en el código.
