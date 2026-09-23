# TAREAS.md — Alverde System

> **Fuente de verdad para agentes de IA.** Leé esto antes de tocar cualquier cosa.
> Actualizado: 2026-09-23 00:10 ART

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
| `backup.ts` conexión huerfana | ✅ Corregido | `db.close()` en `oncomplete`/`onerror` de cada transacción |
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

## 🚧 FASE 1 — EN CURSO

### PRs abiertos ahora mismo

| PR | Rama | Agente | Contenido | Estado |
|---|---|---|---|---|
| [#2](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/pull/2) | `agente-d-diseno` | D | Sistema de diseño: tokens, componentes, DISENO.md | 🟡 Listo, pendiente merge |
| [#3](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/pull/3) | `agente-a-catalogo` | A | Catálogo con búsqueda, filtros, offline, exportación | 🟡 Listo, pendiente merge |
| [#4](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/pull/4) | `agente-b-roles` | B | ClassifierManager (RF-03) + migración SQL faltantes+auditoría | 🟡 Listo, pendiente merge |

### Ramas en trabajo

| Rama | Agente | Contenido | Estado |
|---|---|---|---|
| `agente-c-faltantes` | C | FaltantesPage (RF-49/50/51) | 🔴 En progreso |

### Orden de merge recomendado

```
PR #2 (diseño) → PR #3 (catálogo) → PR #4 (roles+SQL) → PR Agente C (faltantes)
```
Cada rama está construida sobre la anterior. Mergear en ese orden o actualizar las ramas con `git merge main` antes.

### Bugs conocidos pendientes (no bloqueantes para Fase 1)

- **`sync.ts` sin retry exponencial**: si Supabase devuelve error 5xx, la operación se marca como fallida en vez de reintentarse. Fix antes de Fase 3 (caja).
- **RLS auditoría completa**: el smoke test verifica que RLS está habilitado en 4 tablas. La auditoría política por política (qué puede hacer cada rol en cada tabla) quedó pendiente. Resolver antes de Fase 3.
- **`sin-blur` y fallbacks CSS**: `backdrop-filter` no tiene fallback para Edge antiguo. Fix en PR #2 antes de merge.

---

## 📋 REGLAS PARA AGENTES (de AGENTS.md)

- **Nadie escribe directo en `main`** — una rama por feature, PR obligatorio
- **El esquema SQL es la fuente de verdad** — solo `20260922060000_phase_0_foundation.sql`
- **Costos y márgenes NUNCA en el frontend de empleado** — enforcement en RLS, no solo UI
- **Convención de nombres**: tablas en inglés, variables CSS y variantes de componentes en español
- **No toques `Cluade fases/`** — es material de referencia de Claude Fable 5.1, no código de producción

---

## 📅 Registro de avance

| Fecha | Agente | Logro |
|---|---|---|
| 2026-09-22 03:00 | Antigravity | Migración SQL + fixes CSS/Login |
| 2026-09-22 18:00 | Antigravity | Diagnóstico CI: conflicto entre 2 migraciones |
| 2026-09-22 18:30 | Antigravity | Merge PR #1, TAREAS.md, CI actualizado |
| 2026-09-22 18:26 | Claude Fable 5.1 | Subió kit de diseño completo a `Cluade fases/` (sin commitear al repo) |
| 2026-09-22 21:30 | Antigravity | PR #2: sistema de diseño (Agente D) |
| 2026-09-22 22:33 | Antigravity | PR #3: catálogo funcional (Agente A) |
| 2026-09-22 23:10 | Gemini Pro | Escribió migración SQL faltantes+auditoría, ClassifierManager y FaltantesPage |
| 2026-09-22 23:44 | Antigravity | PR #4: ClassifierManager corregido + migración SQL (Agente B) |
| 2026-09-22 23:55 | Claude Sonnet | Identificó causa real del fallo de tests: `backup.ts` + `smoke_test.sql` en español |
| 2026-09-23 00:01 | Antigravity | Fix `smoke_test.sql` (19 tablas en inglés) |
| 2026-09-23 00:03 | Antigravity | Fix `backup.ts` (`db.close()` post-transacción) — causa raíz real |
| 2026-09-23 00:08 | Emiliano (humano) | Verificó `npm test` en máquina real: **2/2 verde** ✅ |
| 2026-09-23 00:10 | Antigravity | **FASE 0 declarada completa** — CI verde, tests verdes |
