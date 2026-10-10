# Estado de implementación y QA

**Corte:** 10 de octubre de 2026 (segundo corte del día)  
**Rama y commit revisados:** `main`, `15f029e`, más los PR #111 a #114 (abiertos al corte; este documento se mergea después de ellos)  
**Veredicto: en desarrollo, pendiente de QA manual. No aprobado para producción.**

## Qué se revisó

Cada uno de los 70 RF y los 10 RNF de `requisitos-sistema-dietetica.md` contra el código, las migraciones y los tests de `main`. Desde el corte anterior: la revisión de seguridad (#107 a #114) y el pgTAP de RF-67. La matriz completa está en [TAREAS.md](../TAREAS.md). Se abandona el porcentaje ponderado del corte del 30 de septiembre: una matriz por requisito es más honesta que un número.

## Resumen

| Categoría | RF | RNF |
|---|---:|---:|
| En código con test que falla si se rompe | 66 | 7 |
| Parcial (existe, no como está escrito) | 2 (RF-42, RF-59) | 1 (RNF-01) |
| Operativo, pendiente | 2 (RF-44, RF-52) | 2 (RNF-02, RNF-03 sin medición) |
| Faltante | 0 | 0 |

Recuento sobre la matriz de `TAREAS.md`. RF-67 pasa a «con test» (#111). RF-59 sigue parcial sólo porque las cuentas se crean desde el panel de Supabase; activar y dar de baja ya se hace desde la app (#113). RNF-06 tiene test y le falta la revisión visual en dispositivos reales.

## Evidencia observada

- CI de `main` en `15f029e` (merge de #110): [run 38026970006](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/actions/runs/38026970006), `success` en `frontend`, `database`, `database-strict` y `e2e`. Cada PR de #89 a #114 tuvo su CI verde antes de entrar o al abrirse.
- Suite con #111 a #114 integrados en una rama local: 541 aserciones pgTAP en 34 archivos, 335 Vitest en 57 archivos y Playwright (`auth.spec.ts`, `sale.spec.ts`, `employee-stock-operations.spec.ts`) contra Supabase local. Cada RPC o control nuevo tiene pgTAP con `anon`, empleado, otro empleado y administradora; los de seguridad, también con cuentas dadas de baja, y se comprobó que fallan sin la migración.
- **Permisos como producción.** `database` corre `supabase test db` con los privilegios automáticos de Supabase. `database-strict` corre las mismas migraciones y pruebas con el arnés de `qa/pg-harness/` (`npm run test:db:nodocker`), con los privilegios del proyecto de producción. Lo agregaron #95 y #97, después de que en producción aparecieran «permission denied» que las pruebas no veían. Tienen que pasar los dos.
- Base de datos: 44 migraciones con #111 a #114, ninguna editada después de creada (job `migrations`).

## Revisión de seguridad (#107 a #114)

Se revisó el repositorio, todo el historial de git, el CI y la comunicación entre el sitio y la base. No hay credenciales en el repo ni en el historial; la clave pública de Supabase en el sitio es lo esperado, y lo que protege los datos son las políticas de la base. Cada hallazgo se reprodujo en la base local con roles reales antes de arreglarlo:

- **Alta (#107):** dar de baja no cortaba el acceso y, como toda cuenta nueva nace como empleado activo, una cuenta creada por registro abierto podía leer los datos de los clientes y cargar fiado. Ahora sólo el personal activo lee y opera.
- **Media:** retocar el turno de caja con llamadas directas (#109); abrir turno en una caja de otra sucursal (#110); dar de baja sin control y sólo por SQL (#113).
- **Baja y prevención:** venta en turno cerrado sin aviso (#112); sin cabeceras de seguridad (#114); nada impedía publicar la clave secreta (#108).

El detalle, con el SQL de cada uno, está en `TAREAS.md`.

## Rediseño (RNF-06, #98 a #105)

Todas las páginas usan el sistema de diseño de Claude Design (tokens, temas Botanical y Midnight, componentes de `src/shared/ui`) y ya no queda CSS del marcado anterior. Los tests de `tests/theme/` controlan los tokens en los dos temas, los componentes, que las hojas por página no fijen colores, que Administración no muestre códigos de requisito ni emojis, y la pantalla de Ingreso.

En el rediseño se encontraron y corrigieron defectos de comportamiento: Márgenes no se podía abrir, Anular no pedía confirmación, las fuentes no cargaban, vencimientos y ventas nocturnas con el día corrido por la zona horaria, el buscador no buscaba por marca, un texto de costos visible para Empleado, «Unir con…» con `window.confirm` y «Crear cliente» habilitado sin conexión. El detalle por PR está en `TAREAS.md`.

## Lo que la evidencia automática no cubre

1. **Ninguna pantalla nueva se probó en un navegador contra la base real.** Esto incluye #82 a #88, las de sucursales y todo el rediseño. Se probó la lógica (pgTAP, Vitest), el e2e del CI contra Supabase local y, para el rediseño, un *preview* con datos simulados en los dos temas, a 1366 y 390 px. La planilla manual tiene que recorrerlas.
2. Hardware: lector de códigos, balanza, notebook con Edge, celulares.
3. Restauración de un respaldo (RF-44).
4. Cola offline tras cierre abrupto y sincronización de dos cajas a la vez (RF-37/38), con datos observados.
5. Configuración cloud: `main` sin protección en GitHub; Cloudflare Pages despliega cada merge sin esperar al CI.
6. Configuración de Supabase en producción: si el registro abierto está apagado y qué SQL de seguridad quedaron aplicados. No se pudo ver desde la sesión; el dueño lo tiene que confirmar con la consulta de control de cada SQL.
7. Las cabeceras de seguridad (#114) se probaron con la build servida localmente, sin datos reales: falta mirar la consola del navegador en producción.

## Bloqueos antes de producción

1. Ejecutar y firmar `docs/PLANILLA_VALIDACION_MANUAL.md` con dispositivos y entorno reales.
2. Ensayar la restauración completa y dejar evidencia fechada.
3. Proteger `main`; revisar que los datos de prueba del e2e no hayan quedado en producción (consultas en #74).
4. Conteo físico inicial (RF-52) y alta de usuarios (RF-59) antes de operar.
5. Decisiones de la dueña: redondeo a $100 en la masiva (RF-28), corte de luz (RNF-01), tema por defecto.
6. QA visual del rediseño con rol Empleado en los dos temas (RNF-04, RNF-06).
7. Seguridad: apagar el registro abierto en Supabase, aplicar los SQL de #107, #109, #110, #112 y #113 con su control, y confirmar en Cloudflare que `VITE_SUPABASE_ANON_KEY` es la clave pública.
