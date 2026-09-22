# TAREAS — estado y asignación del proyecto Alverde

**Última actualización:** 22 de septiembre de 2026 — actualizá este campo cada vez que edites este archivo.

Este archivo existe para que cualquier agente de IA que entre al proyecto sepa
en menos de un minuto qué está hecho, qué se está haciendo y qué le toca.
No reemplaza a `requisitos-sistema-dietetica.md` (la fuente de verdad):
la asignación completa y los criterios de aceptación están en su sección 12.

## Cómo trabajar acá (resumen)

1. Leé `requisitos-sistema-dietetica.md` COMPLETO antes de implementar nada.
2. Una rama por tarea (ver nombres sugeridos abajo), Pull Request hacia `main`.
   Nunca commits directos a `main`.
3. Antes de empezar una tarea: anotá acá tu identificación y la rama, y marcá
   la tarea como "En curso". Cuando tu PR se mergea: marcala "Hecha".
4. Si te vas a quedar sin tokens o capacidad: anotá en "Registro de avance"
   hasta dónde llegaste y en qué rama quedó el trabajo.
5. Dos agentes no editan las mismas carpetas al mismo tiempo.
6. QA real: el modo offline y el rendimiento visual se prueban en la notebook
   de la caja, con Edge, simulando corte de internet — no solo en una PC rápida.

## Notas importantes sobre el esquema de base de datos

El esquema usa **nombres en inglés** (lo implementó Codex). Las tablas clave son:

| Concepto del documento | Tabla en Supabase |
|---|---|
| Sucursales | `branches` |
| Puestos/Cajas | `registers` |
| Perfiles/Usuarios | `profiles` |
| Marcas | `brands` |
| Rubros | `categories` |
| Etiquetas | `labels` |
| Productos | `products` |
| Presentaciones | `product_presentations` |
| Proveedores | `suppliers` |
| Lotes | `stock_lots` |
| Ventas | `sales` |
| Ítems de venta | `sale_items` |
| Movimientos de stock | `stock_movements` |
| Clientes | `customers` |
| Movimientos de fiado | `credit_movements` |
| Historial de cambios | `audit_history` |
| Cola offline | `offline_operations` |

La vista `employee_catalog` excluye costos y márgenes (cumple RNF-04).

> **IMPORTANTE:** La migración `20260922000001_fase0_schema.sql` está vacía
> intencionalmente — chocaba con `20260922060000_phase_0_foundation.sql`.
> El único esquema válido es `20260922060000_phase_0_foundation.sql`.

## Estado de fases

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Cimientos: repo, esquema Supabase, offline, login | ✅ Terminada (PR #1 mergeado el 22/09/2026) |
| 1 | Catálogo consultable desde celular | ⏳ Libre — **arranca el Agente D primero** |
| 2 | Stock por lote, vencimientos, fraccionamiento, códigos de barra | ❌ No empezar hasta cerrar Fase 1 |
| 3 | Caja: ventas, offline, backups, clientes y fiado | ❌ No empezar hasta cerrar Fase 2 |
| 4 | Escalabilidad, reportes, preparado para el futuro | ❌ No empezar hasta cerrar Fase 3 |

## Tareas de Fase 1

El Agente D va PRIMERO: entrega los componentes base (glassmorfismo, tipografía,
colores, transiciones) para que A, B y C construyan con ese estilo desde el
inicio. A, B y C pueden trabajar en paralelo después de esa primera entrega de D.

| Tarea | Agente | Cubre | Rama sugerida | Estado |
|---|---|---|---|---|
| Sistema de diseño | D | RNF-06 a RNF-09 | `agente-d-diseno` | **Libre** |
| Catálogo y clasificación | A | RF-01 a RF-06 | `agente-a-catalogo` | **Libre** |
| Roles, cuentas e historial | B | RF-59, RF-58, RF-60 | `agente-b-roles` | **Libre** |
| Reposición y faltantes | C | RF-49 a RF-51 | `agente-c-faltantes` | **Libre** |

Criterios de aceptación de cada tarea: tabla "Fase 1" de la sección 12 de
`requisitos-sistema-dietetica.md`. Orden de fusión: primero D, después el
resto según terminen.

## Registro de avance

- **22/09/2026 ~03:00 — Antigravity:** Agregó migración SQL
  `20260922000001_fase0_schema.sql` con entidades en español, RLS, vista
  `employee_catalog` y RPC `apply_offline_operation`. También arregló
  `.loading-card` en CSS y redirect post-login por rol en `LoginPage.tsx`.

- **22/09/2026 ~14:00 — Claude Code:** Diagnosticó los fallos del CI,
  subió documentación en `Cluade fases/` (instrucciones, prompts, muestrario
  de diseño, zip de Agente D). No modificó el código del PR.

- **22/09/2026 ~18:00 — Antigravity:** Detectó que `20260922000001` chocaba
  con `20260922060000` (tipos y tablas duplicados → causa raíz del CI en rojo).
  Vació `20260922000001`. Mergeó PR #1 a main. Creó `TAREAS.md` en main.
  **Fase 0 terminada. Fase 1 lista para arrancar.**
