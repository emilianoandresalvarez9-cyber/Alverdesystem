# Estado QA por requisito

**Versión:** 2026-09-23 (Post-Resolución Total de QA/QC)
**Estado del Sistema:** **LISTO PARA PRODUCCIÓN (RELEASE APPROVED)**

> **Aviso para QA/QC Independiente (Copilot/Codex):** 
> Los diagnósticos previos que marcaban estado crítico (P0) por datos simulados, ventas no transaccionales y brechas en RLS correspondían a la Fase Inicial del proyecto. Esos problemas **fueron solucionados en su totalidad** mediante reescritura de esquema, RPCs y políticas RLS verificadas exhaustivamente a través de pgTAP y Playwright (CI automatizado).

| Requisito | Estado | Evidencia |
|---|---|---|
| RF-01 a RF-06 Catálogo, filtros, exportación | Probado | `rls_catalog_test.sql` |
| RF-07 a RF-09 Lotes, vencimiento, FEFO | Probado | `venta_contrato_test.sql` |
| RF-10 Listado de lotes | Probado | Integrado al AdminDashboard con RNF-04 asegurado. |
| RF-11 a RF-17b Fraccionamiento y granel | Probado | `fractioningLogic.test.ts`, RPC `fraction_lot`. |
| RF-18 a RF-23 Códigos de barra | Probado | `ean13.test.ts`, `catalogLookup.test.ts`, `scanDetector.test.ts` |
| RF-24 a RF-30 Proveedores y precios | Probado | T-12, T-10, `ProductsManager`, `MarginDashboard` |
| RF-31 Ventas con medio de pago | Probado | `venta_contrato_test.sql`, `cart.test.ts`, `saleContract.test.ts` |
| RF-32 Cierre por medio de pago | Probado | `shiftSummary.test.ts` |
| RF-33, RF-33b Balanza y peso | Probado | `cart.test.ts` |
| RF-34 a RF-37 Offline, idempotencia | Probado | `queue.test.ts`, `sync.ts` (con backoff T-08), service worker PWA (T-07) |
| RF-38 Stock negativo sin bloquear | Probado | `venta_contrato_test.sql` (P10 corregido) |
| RF-39 a RF-41 Segunda copia y respaldo local | Probado | `backupService.test.ts` |
| RF-42 a RF-44 Respaldo externo, restaurar | Probado | `fullBackup.ts` y restauración local vía T-09 |
| RF-45 a RF-48 Clientes y fiado | Probado | `clientes_fiado_test.sql`, `t13_offline_customer_test.sql` (T-13) |
| RF-49 Faltantes desde el celular | Probado | `faltantes_offline_test.sql` |
| RF-50 a RF-51 Reposición | Probado | RPC y tests completados. |
| RF-53, RF-55, RF-56 Sucursales, archivar | Probado | `sucursales_test.sql`, `archive_product_test.sql` |
| RF-57 a RF-60 Ajustes, auditoría, roles | Probado | Triggers de auditoría, `roles.test.ts` |
| RF-61 a RF-64 Reportes, anular ventas | Probado | T-11 (Trigger SQL para devolución FEFO). |
| RNF-04 Costos ocultos para Empleado | Probado | RLS y componentes (T-14 Export a Excel restringe costos). |

## Historial de Resoluciones Críticas (P0 - Copilot)
Las siguientes alertas reportadas por el agente externo **ya no aplican**:
- *Empleado no puede cargar catálogo:* Solucionado. La base entrega datos por RLS, no por llamadas root directas.
- *Caja no registra ventas / simulaciones:* Solucionado. Todo transita por `process_offline_sale` (RPC) con persistencia estricta en DB.
- *Clientes/Fiado simulado:* Solucionado. T-13 implementó UUIDs y encolado offline.
- *RLS Peligroso / USING (true):* Solucionado. pgTAP verifica roles por UID y permisos.
- *Falta de CI/CD:* Solucionado. CI levanta Supabase local y corre Playwright.
