# Estado de implementación y QA

**Corte:** 10 de octubre de 2026  
**Rama y commit revisados:** `main`, `f5f069da49f4c5bfc6ba90e04071b5bbb7d28d03`  
**Veredicto: en desarrollo, pendiente de QA manual. No aprobado para producción.**

## Qué se revisó

Cada uno de los 70 RF y los 10 RNF de `requisitos-sistema-dietetica.md` contra el código, las migraciones y los tests de `main`. Desde el corte anterior se sumaron RF-65 a RF-70 (varias sucursales). La matriz completa está en [TAREAS.md](../TAREAS.md). Se abandona el porcentaje ponderado del corte del 30 de septiembre: una matriz por requisito es más honesta que un número.

## Resumen

| Categoría | RF | RNF |
|---|---:|---:|
| En código con test que falla si se rompe | 65 | 7 |
| Parcial (existe, no como está escrito) | 3 (RF-42, RF-59, RF-67) | 1 (RNF-01) |
| Operativo, pendiente | 2 (RF-44, RF-52) | 2 (RNF-02, RNF-03 sin medición) |
| Faltante | 0 | 0 |

Recuento sobre la matriz de `TAREAS.md`. El resumen del corte anterior decía 59 RF con test, pero su propia matriz sumaba 60: RF-36 entró después del conteo. RNF-06 pasa a «con test» (#98 a #105) y le falta la revisión visual en dispositivos reales.

## Evidencia observada

- CI de `main` en `f5f069d` (merge de #105): [run 38023218822](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/actions/runs/38023218822), `success`. Jobs: `frontend`, `database`, `database-strict`, `migrations`, `e2e`. Cada PR de #89 a #105 tuvo su CI verde antes de entrar.
- Suite: 414 aserciones pgTAP en 28 archivos, 305 Vitest en 51 archivos y Playwright (`auth.spec.ts`, `sale.spec.ts`, `employee-stock-operations.spec.ts`) contra Supabase local. Cada RPC nueva tiene pgTAP con `anon`, empleado, otro empleado y administradora.
- **Permisos como producción.** `database` corre `supabase test db` con los privilegios automáticos de Supabase. `database-strict` corre las mismas migraciones y pruebas con el arnés de `qa/pg-harness/` (`npm run test:db:nodocker`), con los privilegios del proyecto de producción. Lo agregaron #95 y #97, después de que en producción aparecieran «permission denied» que las pruebas no veían. Tienen que pasar los dos.
- Base de datos: 39 migraciones, ninguna editada después de creada (job `migrations`).

## Rediseño (RNF-06, #98 a #105)

Todas las páginas usan el sistema de diseño de Claude Design (tokens, temas Botanical y Midnight, componentes de `src/shared/ui`) y ya no queda CSS del marcado anterior. Los tests de `tests/theme/` controlan los tokens en los dos temas, los componentes, que las hojas por página no fijen colores, que Administración no muestre códigos de requisito ni emojis, y la pantalla de Ingreso.

En el rediseño se encontraron y corrigieron defectos de comportamiento: Márgenes no se podía abrir, Anular no pedía confirmación, las fuentes no cargaban, vencimientos y ventas nocturnas con el día corrido por la zona horaria, el buscador no buscaba por marca, un texto de costos visible para Empleado, «Unir con…» con `window.confirm` y «Crear cliente» habilitado sin conexión. El detalle por PR está en `TAREAS.md`.

## Lo que la evidencia automática no cubre

1. **Ninguna pantalla nueva se probó en un navegador contra la base real.** Esto incluye #82 a #88, las de sucursales y todo el rediseño. Se probó la lógica (pgTAP, Vitest), el e2e del CI contra Supabase local y, para el rediseño, un *preview* con datos simulados en los dos temas, a 1366 y 390 px. La planilla manual tiene que recorrerlas.
2. Hardware: lector de códigos, balanza, notebook con Edge, celulares.
3. Restauración de un respaldo (RF-44).
4. Cola offline tras cierre abrupto y sincronización de dos cajas a la vez (RF-37/38), con datos observados.
5. Configuración cloud: `main` sin protección en GitHub; Cloudflare Pages despliega cada merge sin esperar al CI.

## Bloqueos antes de producción

1. Ejecutar y firmar `docs/PLANILLA_VALIDACION_MANUAL.md` con dispositivos y entorno reales.
2. Ensayar la restauración completa y dejar evidencia fechada.
3. Proteger `main`; revisar que los datos de prueba del e2e no hayan quedado en producción (consultas en #74).
4. Conteo físico inicial (RF-52) y alta de usuarios (RF-59) antes de operar.
5. Decisiones de la dueña: redondeo a $100 en la masiva (RF-28), corte de luz (RNF-01), tema por defecto.
6. QA visual del rediseño con rol Empleado en los dos temas (RNF-04, RNF-06).
