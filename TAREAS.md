# Estado y tareas pendientes — Alverde System

> Corte de revisión: 30 de septiembre de 2026, rama `main`, commit `4b551c6`.
> Avance estimado de implementación: **77%**. No equivale a aprobación de QA ni a aptitud para producción.

## Criterio del porcentaje

Estimación de avance del alcance completo, ponderando: funcionalidades implementadas en código (55%), controles técnicos y CI (25%) y validación operativa/documentación de liberación (20%). La revisión del código y el último workflow visible aportan evidencia; los escenarios manuales sin ejecutar permanecen como pendientes. No es un conteo de líneas ni una certificación funcional.

## Implementado en código (requiere la evidencia indicada antes de darlo por aceptado)

- Catálogo, clasificación y administración de productos, presentaciones, precios y proveedores.
- Autenticación, roles, RLS y vistas restringidas para no exponer costos al empleado.
- Stock por lotes, movimientos, fraccionamiento/granel, códigos de barras y operaciones de caja.
- Ventas, clientes, fiado, reposición/faltantes, auditoría, sucursales y puestos.
- PWA/offline con almacenamiento local, cola de sincronización e idempotencia.
- Backups/exportaciones, reportes y pruebas unitarias, de base de datos y E2E.
- Inicio de desarrollo local sin Docker y modo aislado con Supabase CLI.

La lista describe componentes detectados en el repositorio, no garantiza que todos los flujos cumplan aceptación en hardware y datos reales. Revisar requisito por requisito en `requisitos-sistema-dietetica.md`.

## Pendientes para declarar una versión lista

1. Completar y firmar la [planilla de validación manual](docs/PLANILLA_VALIDACION_MANUAL.md) en entorno real, incluyendo roles, ventas, fiado, offline tras cierre abrupto, recuperación, conflictos y backups.
2. Probar en la notebook de caja con Edge y en dispositivos móviles; registrar versiones, fecha, resultados y defectos.
3. Confirmar el procedimiento de despliegue y configuración cloud con un proyecto Supabase/hosting de destino, sin credenciales en el repositorio.
4. Verificar respaldo y restauración con datos recuperados, y acordar operación ante pérdida de energía/dispositivo.
5. Resolver los casos fallidos o no cubiertos, repetir CI y QA, y actualizar el veredicto con evidencia.

## Evidencia automática observada

El workflow de GitHub Actions más reciente al corte corresponde al commit `4b551c6` y concluyó correctamente el 30/09/2026. Incluye compuerta de frontend, migraciones (en PR), pruebas de base de datos y E2E. Esto acredita que esa ejecución automatizada pasó; no reemplaza pruebas físicas ni confirma que el sistema esté desplegado.

Enlaces: [workflow del commit revisado](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/actions/runs/36704727533) · [estado QA](docs/ESTADO_QA.md) · [validación manual](docs/PLANILLA_VALIDACION_MANUAL.md).

## Registro de cambios de avance

Actualizar esta página cuando una tarea cambie de estado, indicando evidencia (PR/commit, CI o planilla). No marcar “completo” por la sola presencia de componentes en el código.
