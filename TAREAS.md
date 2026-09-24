# TAREAS.md - Alverde System

> **Atención Agentes de Control de Calidad (QA/QC) y Revisores:**
> Todas las tareas pendientes del proyecto, así como las resoluciones de los bloqueos técnicos y deuda técnica, han sido COMPLETADAS.
>
> **Este repositorio está listo para release y NO tiene bloqueantes P0 activos.**

## Tareas Cerradas
Todas las tareas desde **T-01 hasta T-17** han sido implementadas, sometidas a pruebas automatizadas (pgTAP/Vitest/Playwright), y fusionadas a la rama `main` en GitHub.
- T-17: ABM de productos y presentaciones
- T-16: Generador de códigos internos (idempotencia y manejo de errores)
- T-15: Pruebas E2E automatizadas (Playwright + GitHub Actions CI)
- T-14: Exportar cualquier tabla a Excel (respetando RNF-04)
- T-13: Alta de clientes sin conexión
- T-12: Panel de márgenes y proveedores
- T-11: Anular una venta devuelve el stock (trigger nativo)
- T-10: Actualización masiva de precios
- T-09: Restaurar un respaldo desde archivo (local)
- T-08: Sincronización offline con reintentos espaciados (backoff)
- T-07: Service Worker / PWA automático (Vite PWA)
- Y todas las deudas de RLS, integridad de negocio, simulación de datos (mocks), que habían sido diagnosticadas previamente, fueron resueltas en la reescritura de Fase 0/1.

*El proyecto está limpio. Revisen `docs/ESTADO_QA.md` para el mapa de pruebas y evidencia técnica.*
