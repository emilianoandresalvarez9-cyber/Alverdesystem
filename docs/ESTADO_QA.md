# Estado de implementación y QA

**Corte:** 9 de octubre de 2026  
**Rama y commit revisados:** `main`, `fa5db8904370ae6a7b1b1e362b5bf6eb75ec3a8e`  
**Veredicto: en desarrollo, pendiente de QA manual. No aprobado para producción.**

## Qué se revisó

Cada uno de los 64 RF y los 10 RNF de `requisitos-sistema-dietetica.md` contra el código, las migraciones y los tests de `main`. La matriz completa está en [TAREAS.md](../TAREAS.md). Se abandona el porcentaje ponderado del corte anterior: una matriz por requisito es más honesta que un número.

## Resumen

| Categoría | RF | RNF |
|---|---:|---:|
| En código con test que falla si se rompe | 59 | 6 |
| Parcial (existe, no como está escrito) | 2 (RF-42, RF-59) | 2 (RNF-01, RNF-06 en curso) |
| Operativo, pendiente | 2 (RF-44, RF-52) | 2 (RNF-02, RNF-03 sin medición) |
| Faltante | 0 | 0 |

## Evidencia observada

- Último workflow completado de `main` al corte: [run 38006285482, commit `abafc74`](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/actions/runs/38006285482), `success`. Los merges posteriores (#86, #87) estaban con CI en curso; cada PR tuvo sus cuatro checks verdes antes de entrar.
- Suite: 313 pruebas pgTAP (`supabase test db`), 126 Vitest, Playwright `e2e/sale.spec.ts` contra Supabase local. Cada RPC nueva tiene pgTAP con `anon`, empleado, otro empleado y administradora.
- Base de datos: 25 migraciones, ninguna editada después de creada (job `migrations`).

## Lo que la evidencia automática no cubre

1. **Ninguna pantalla de #82 a #88 se probó en un navegador contra una base real.** Se probó la lógica (pgTAP, Vitest) y que compila con los tipos generados. La planilla manual tiene que recorrerlas.
2. Hardware: lector de códigos, balanza, notebook con Edge, celulares.
3. Restauración de un respaldo (RF-44).
4. Cola offline tras cierre abrupto, sincronización de dos cajas a la vez (RF-37/38) con datos observados.
5. Configuración cloud: `main` sin protección en GitHub; Cloudflare Pages despliega cada merge sin esperar al CI.

## Bloqueos antes de producción

1. Ejecutar y firmar `docs/PLANILLA_VALIDACION_MANUAL.md` con dispositivos y entorno reales.
2. Ensayar restauración completa y dejar evidencia fechada.
3. Proteger `main`; revisar que los datos de prueba del e2e no hayan quedado en producción (consultas en #74).
4. Decisiones de la dueña: redondeo a $100 en la masiva (RF-28), corte de luz (RNF-01), tema por defecto.
5. Terminar RNF-06 y volver a correr QA visual con rol Empleado en los dos temas (RNF-04).
