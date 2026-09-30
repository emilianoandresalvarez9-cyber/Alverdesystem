# Estado de implementación y QA

**Corte:** 30 de septiembre de 2026  
**Rama y commit revisados:** `main`, `4b551c6368b4f469e4615717fa0dd4a7620039e5`  
**Estimación:** **77% de implementación**. **No aprobado para producción**: queda validación manual y operativa.

## Cómo leer el porcentaje

Es una estimación de avance del alcance (no de calidad ni de líneas de código), ponderada así:

| Área | Peso | Evaluación | Evidencia |
|---|---:|---:|---|
| Funcionalidades previstas | 55% | 85% | Módulos de interfaz, lógica y migraciones presentes para catálogo, inventario, ventas, offline, clientes/fiado, administración y reportes. La presencia en el repo no demuestra aceptación de cada RF. |
| Controles técnicos automatizados | 25% | 90% | El workflow de CI del commit revisado terminó en `success`; configura guard, tipos, tests, build, base de datos y Playwright. |
| Validación operativa y liberación | 20% | 40% | Existe plan de despliegue e inicio local; la planilla manual está sin firmar, no hay evidencia de validación física ni de restauración real. |
| **Total ponderado** | **100%** | **77.25% ≈ 77%** | Estimación redondeada. |

La puntuación es orientativa y debe reducirse si la comprobación requisito por requisito encuentra faltantes. No mide uso, adopción ni éxito comercial.

## Evidencia observada

- Último workflow de `main`: [run 178, commit `4b551c6`](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/actions/runs/36704727533), completado con conclusión `success` el 30/09/2026.
- El CI definido ejecuta guard, typecheck, tests, build, pruebas de base de datos y E2E; el chequeo de inmutabilidad de migraciones corre en PR.
- El repositorio contiene pruebas Vitest, pgTAP y Playwright, migraciones Supabase, PWA/offline y procedimientos de desarrollo.
- No se observó PR abierto al momento de la revisión. Las referencias anteriores a un PR o a “release funcional y seguro” se retiraron por no corresponder al estado comprobable.

## Capacidades detectadas en el código

Catálogo y clasificación; administración de productos y precios; autenticación/RLS y vistas con datos restringidos; lotes, stock y fraccionamiento; ventas y operaciones offline; clientes y fiado; faltantes/reposición; códigos de barras; auditoría; sucursales/cajas; respaldos/exportaciones y reportes.

Esta lista es inventario del código, no certificación de que cada requerimiento funcional esté aceptado. La matriz pendiente debe vincular cada RF con implementación, test y resultado manual.

## Bloqueos antes de producción

1. Ejecutar y firmar los escenarios de `docs/PLANILLA_VALIDACION_MANUAL.md` con dispositivos y entorno reales.
2. Probar recuperación del dispositivo, cola offline después de cierre abrupto, sincronización concurrente e idempotencia observando los datos persistidos.
3. Validar copia y restauración de respaldo de punta a punta.
4. Confirmar despliegue cloud, secretos/variables, usuarios/roles y procedimiento de soporte.
5. Revisar con la dueña la continuidad ante corte de energía: una aplicación en navegador no puede operar si el equipo carece de energía.
6. Corregir defectos detectados y conservar evidencia fechada de CI y QA.

## Veredicto

**Estado: en desarrollo / pendiente de QA manual. No usar como sistema de producción todavía.**  
El éxito del CI confirma únicamente esa ejecución automatizada; no valida hardware, uso real, restauración, configuración cloud ni aceptación de negocio.
