# TAREAS.md — Alverde System

> **Fuente de verdad para agentes de IA.** Leé esto antes de tocar cualquier cosa.
> Actualizado: 2026-09-23 00:30 ART

---

## ✅ FASE 0 — COMPLETADA Y VERIFICADA

**Tests: 2/2 pasando. CI: verde.**

### Qué está en `main` ahora mismo

| Área | Estado | Notas |
|---|---|---|
| Esquema SQL | ✅ Completo | `20260922060000_phase_0_foundation.sql` — tablas en inglés |
| Migración conflictiva | ✅ Resuelta | `20260922000001_fase0_schema.sql` vaciada (solo comentarios) |
| `smoke_test.sql` | ✅ Corregido | Verifica las 19 tablas reales en inglés + RLS + vista sin costos |
| `queue.ts` race condition | ✅ Corregido | `pendingMirror` trackea el mirror; `await pendingMirror` en reset |
| `backup.ts` conexión huérfana | ✅ Corregido | `db.close()` en `oncomplete`/`onerror` de cada transacción |
| Login con redirección por rol | ✅ Funciona | admin → `/admin.html`, empleado → `/catalog.html` |
| Build (3 HTML) | ✅ Pasa | `npm run build` genera login, catalog, admin correctamente |
| TypeCheck | ✅ Pasa | `npm run typecheck` sin errores |
| Tests | ✅ **2/2 verde** | `npm test` — verificado en máquina real 2026-09-23 |

### Esquema de base de datos (Supabase — todos los nombres en inglés)

| Concepto | Tabla real |
|---|---|
| Sucursales | `branches` |
| Puestos/Cajas | `registers` |
| Perfiles/Usuarios | `profiles` |
| Marcas | `brands` |
| Rubros | `categories` |
| Etiquetas | `labels` |
| Productos | `products` |
| Relación producto-etiqueta | `product_labels` |
| Presentaciones | `product_presentations` |
| Proveedores | `suppliers` |
| Relación proveedor-producto | `supplier_products` |
| Lotes de stock | `stock_lots` |
| Movimientos de stock | `stock_movements` |
| Ventas | `sales` |
| Ítems de venta | `sale_items` |
| Clientes | `customers` |
| Fiado | `credit_movements` |
| Historial de auditoría | `audit_history` |
| Cola offline | `offline_operations` |

**Tipos PostgreSQL custom:** `app_role` (administrator/employee), `base_unit` (gram/millilitre/unit), `stock_lot_status`, `sale_status`, `payment_method`, `stock_movement_kind`, `credit_movement_kind`, `offline_operation_kind`

### Sistema de diseño (Agente D — en PR #2)

Variantes y props **reales** de los componentes (convención en español):

```tsx
// Button — variant: "primario" | "secundario" | "fantasma" | "peligro"
<Button variant="primario">Guardar</Button>

// Badge — tone: "neutro" | "exito" | "aviso" | "error"
<Badge tone="exito">Activo</Badge>

// SelectField — usa children (<option>), NO prop options
<SelectField label="Marca" value={v} onChange={e => setV(e.target.value)}>
  <option value="1">Del local</option>
</SelectField>

// EmptyState — prop title + children, NO prop message ni icon
<EmptyState title="Sin productos">Agregá el primero.</EmptyState>

// TextField — extiende InputHTMLAttributes, onChange ES evento nativo
<TextField label="Nombre" value={v} onChange={e => setV(e.target.value)} />
```

---

## 🚀 FASE 1 — LISTA PARA INTEGRACIÓN (4/4 AGENTES COMPLETADOS)

Todos los agentes de la Fase 1 han completado su implementación y tienen sus correspondientes Pull Requests abiertos:

| PR | Rama | Agente | Contenido / RFs | Estado |
|---|---|---|---|---|
| [#2](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/pull/2) | `agente-d-diseno` | D | Sistema de diseño: tokens, componentes glassmórficos, DISENO.md (RNF-06 a RNF-09) | 🟢 PR Abierto |
| [#3](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/pull/3) | `agente-a-catalogo` | A | Catálogo: búsqueda, filtros combinables, soporte offline, exportación a Excel (RF-01 a RF-06) | 🟢 PR Abierto |
| [#4](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/pull/4) | `agente-b-roles` | B | ClassifierManager (RF-03) + migración SQL `missing_items` con RLS y triggers de auditoría (RF-49/50, RF-58) | 🟢 PR Abierto |
| [#5](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/pull/5) | `agente-c-faltantes` | C | Faltantes, reposición agrupada por proveedor e ingreso rápido con código de barras (RF-49, RF-50, RF-51) | 🟢 PR Abierto |

### Orden de merge e integración recomendado:

```text
PR #2 (Diseño) ──▶ PR #3 (Catálogo) ──▶ PR #4 (Roles y Auditoría) ──▶ PR #5 (Faltantes)
```

Cada rama fue construida de forma incremental. Al mergear en este orden secuencial, todos los componentes, estilos y migraciones se integran de manera limpia en `main`.

---

## 📋 REGLAS PARA AGENTES (de AGENTS.md)

- **Nadie escribe directo en `main`** — una rama por feature, PR obligatorio
- **El esquema SQL es la fuente de verdad** — solo `20260922060000_phase_0_foundation.sql` + migraciones incrementales
- **Costos y márgenes NUNCA en el frontend de empleado** — enforcement en RLS, no solo UI
- **Convención de nombres**: tablas de base de datos en inglés; variables CSS y variantes de componentes de UI en español
- **No tocar `Cluade fases/`** — es material de referencia estático

---

## 📅 Registro de avance cronológico

| Fecha | Agente | Logro |
|---|---|---|
| 2026-09-22 03:00 | Antigravity | Migración SQL + fixes CSS/Login |
| 2026-09-22 18:00 | Antigravity | Diagnóstico CI: conflicto entre 2 migraciones |
| 2026-09-22 18:30 | Antigravity | Merge PR #1, TAREAS.md, CI actualizado |
| 2026-09-22 18:26 | Claude Fable 5.1 | Kit de diseño en `Cluade fases/` |
| 2026-09-22 21:30 | Antigravity | PR #2: sistema de diseño (Agente D) |
| 2026-09-22 22:33 | Antigravity | PR #3: catálogo funcional (Agente A) |
| 2026-09-22 23:10 | Gemini Pro | Migración SQL faltantes+auditoría, borrador ClassifierManager y FaltantesPage |
| 2026-09-22 23:44 | Antigravity | Adaptación y corrección de ClassifierManager con API real de diseño |
| 2026-09-22 23:55 | Claude Sonnet | Diagnóstico de tests: `backup.ts` + `smoke_test.sql` |
| 2026-09-23 00:01 | Antigravity | Fix `smoke_test.sql` (19 tablas en inglés) |
| 2026-09-23 00:03 | Antigravity | Fix `backup.ts` (`db.close()` en cada transacción) — causa raíz resuelta |
| 2026-09-23 00:08 | Emiliano (humano) | Verificación local de `npm test`: **2/2 verde** ✅ |
| 2026-09-23 00:10 | Antigravity | **FASE 0 finalizada y verificada** |
| 2026-09-23 00:25 | Antigravity | PR #4: Agente B abierto (`agente-b-roles`) |
| 2026-09-23 00:29 | Antigravity | PR #5: Agente C abierto (`agente-c-faltantes`) — Fase 1 100% implementada en PRs |
