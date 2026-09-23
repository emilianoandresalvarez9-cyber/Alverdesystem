# TAREAS.md — Alverde System

> Backlog para agentes. Las reglas de trabajo están en `AGENTS.md` y mandan sobre este archivo.
> El estado de cada requisito está en `docs/ESTADO_QA.md`. Nadie marca una tarea como terminada:
> la cierra QA con la evidencia pedida en su criterio de aceptación.

**Estado del sistema: NO APTO PARA PRODUCCIÓN.** Los bloqueantes de datos y seguridad conocidos
están corregidos y probados (PR-01 a PR-09), pero faltan las tareas P0 de abajo y ninguna prueba se
hizo todavía en el hardware real de la caja.

El historial anterior (canal de agentes, diagnósticos, hoja de ruta de Codex) está en `docs/historico/`.

## P0 — Bloquean producción

| Id | Tarea | Criterio de aceptación (evidencia que pide QA) |
|---|---|---|
| T-01 | RPCs atómicas para ajuste de stock, ingreso rápido y fraccionamiento. Hoy son 2 a 5 escrituras sueltas desde el navegador (`StockAdjustmentModal`, `QuickRestock`, `FractioningModal`); si falla una a la mitad queda stock inconsistente. `QuickRestock` además ignora el error del movimiento. | Una RPC por operación, `security definer`, solo administradora. Test pgTAP que fuerza un error a mitad de camino y verifica que no quedó ninguna fila. El ejemplo de los requisitos (1000 g → bolsitas de 150 g, sobran 100 g) registra la merma correcta. |
| T-02 | ~~Decidir ADR-001 y pantalla "Balanza"~~ — resuelto en PR-10. Queda: la dueña marca en Administración → Balanza cada presentación que se vende suelta. | Lista de presentaciones marcadas revisada por la dueña. |
| T-03 | Prueba en condiciones reales: notebook de la caja con Edge, lector Nictom LCB3100 y corte de internet (regla general de QA de los requisitos). | Planilla con cada paso, resultado y captura: escanear código de fabricante y código interno, vender por peso, vender sin internet, apagar la notebook de golpe con ventas pendientes, reconectar y ver que llegó cada venta una sola vez, cerrar turno y abrir el respaldo descargado. |
| T-04 | Primer corrida del CI nuevo en GitHub (`supabase test db`). El arnés local (`qa/pg-harness`) emula Supabase; si difieren, manda el CI. | Enlace al run verde de los 3 jobs sobre `main`. |
| T-05 | Proteger `main` en GitHub (Settings → Branches/Rules): exigir PR, exigir los checks `frontend`, `database` y `migrations`, bloquear force push. **Lo hace la dueña del repo.** | Captura de la regla activa. |

## P1 — Funcionalidad incompleta

| Id | Tarea | Criterio de aceptación |
|---|---|---|
| T-06 | Reportes en el servidor (GRAVE-01/02): `ReportsDashboard` descarga todas las ventas al navegador y usa `any`. | Funciones SQL agregadas por día, producto y rubro; el navegador recibe solo totales. Test pgTAP con ventas conocidas que verifica cada total. Cero `any` en `src/modules/reports`. |
| T-07 | Service Worker que precachea los assets con hash de Vite (GRAVE-05). Hoy la primera visita sin conexión no tiene JS ni CSS. | Manifest generado en el build y precacheado en `install`. Prueba: instalar, cortar red, recargar cada página. |
| T-08 | Sincronización con reintentos espaciados y corte ante error de red (GRAVE-03). Hoy un error de red marca como fallidas todas las operaciones. | Test unitario con un cliente simulado: un error de red detiene el lote sin marcar el resto; los reintentos crecen hasta un máximo. |
| T-09 | Restaurar un respaldo (RF-44) y guardarlo fuera de la notebook (RF-42). | Restaurar el JSON del cierre en un equipo limpio devuelve la cola pendiente; prueba documentada de restauración completa de la base. |
| T-10 | Precios (RF-25 a RF-30): multiplicador ×2 pisable por rubro/producto, redondeo a múltiplo de 100, historial, actualización masiva con vista previa y lista de productos a reetiquetar. | Tests de la regla de precio (incluido redondeo) y pgTAP del historial. Los costos nunca llegan a Empleado (test con rol empleado). |
| T-11 | Anular una venta devuelve el stock y, si era fiada, revierte el cargo. Hoy solo cambia el estado. | pgTAP: vender, anular, verificar lotes y saldo del cliente. |
| T-12 | Proveedores (RF-24) y panel de márgenes solo para administradora (RF-26). | ABM funcional; test de RLS que muestra que un empleado no lee costos. |
| T-13 | Alta de clientes sin conexión (hoy necesita red). | Nuevo tipo de operación offline con id generado en el equipo; test de idempotencia. |
| T-14 | Exportar cualquier tabla a Excel (RF-43); hoy solo el catálogo. | Exportación de ventas, lotes y clientes, respetando RNF-04 para Empleado. |
| T-16 | Generador de códigos internos (P13): arma el código con los primeros dígitos del UUID (puede repetir) e ignora el error al guardar. | Secuencia en la base para el número interno; test de 1000 códigos sin repetir; error visible si falla el guardado. Nunca usa el prefijo 29. |
| T-17 | Alta y edición de productos y presentaciones desde Administración (hoy solo desde Supabase Studio). | ABM con archivado (RF-56), historial de precios (RF-27) y tests de RLS. |
| T-15 | Pruebas E2E automatizadas (Playwright) de caja, fiado y faltantes. | Suite en CI con Supabase local. |

## P2 — Calidad

- Quitar `any` restantes (`CounterBulkSheet`, `BranchesManager` anterior ya reemplazado, `fullBackup`).
- `src/integration.test.ts` prueba solo `allocateByFefo` en TypeScript: renombrarlo y mover los flujos reales a E2E.
- Revisar que las transiciones (RNF-07/08) y el desenfoque no generen lag en la notebook de la caja.
