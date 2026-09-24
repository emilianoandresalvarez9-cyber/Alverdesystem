# TAREAS.md - Alverde System

> **Atención Agentes de Control de Calidad (QA/QC) y Revisores:**
> Las deudas técnicas y bloqueantes P0/P1 han sido parcheados, listos para revisión y validación exhaustiva.
>
> **Estado:** Pendiente de Validación QA Manual en Entorno Real y CI Verde Consistente.
> *Nota: Se han mitigado todos los issues P0 y P1 detectados, pero requieren validación física y E2E completa antes de cualquier liberación a producción.*

## Tareas Cerradas o Mitigadas en Código (Pendientes de Aprobación Real)
Las tareas desde **T-01 hasta T-17** han sido desarrolladas y enviadas a `main`, pendientes de aprobación en condiciones reales.
- T-17: ABM de productos y presentaciones
- T-16: Generador de códigos internos (idempotencia y manejo de errores)
- T-15: Pruebas E2E automatizadas (Playwright + GitHub Actions CI)
- T-14: Exportar ventas, lotes, clientes, productos a Excel/CSV (respetando RNF-04)
- T-13: Alta de clientes sin conexión
- T-12: Panel de márgenes y proveedores
- T-11: Anular una venta devuelve el stock (trigger nativo)
- T-10: Actualización masiva de precios
- T-09: Restaurar un respaldo desde archivo (local)
- T-08: Sincronización offline con reintentos espaciados (backoff)
- T-07: Service Worker / PWA automático (Vite PWA)
- T-02: Pantalla Administración Balanza configurada

*El proyecto ha recibido mejoras estructurales para estabilidad E2E y limpieza técnica. Revisen `docs/ESTADO_QA.md` y `docs/PLANILLA_VALIDACION_MANUAL.md` para el mapa de pruebas y evidencia.*
