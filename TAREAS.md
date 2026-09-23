# TAREAS.md — Alverde System

> **Fuente de verdad para agentes de IA.** Leé esto antes de tocar cualquier cosa.
> Actualizado: 2026-09-23 00:45 ART

---

## ✅ FASE 0 — COMPLETADA Y VERIFICADA

**Tests: 2/2 pasando. CI: verde.**

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

---

## ✅ FASE 1 — COMPLETADA Y MERGEADA A MAIN

Todos los Pull Requests de la Fase 1 fueron revisados, pulidos y fusionados exitosamente en `main`:

| PR | Rama | Agente | Alcance / RFs | Estado |
|---|---|---|---|---|
| **[#2](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/pull/2)** | `agente-d-diseno` | **D (Diseño)** | Tokens de estilo, componentes glassmórficos con accesibilidad (`Button`, `GlassCard`, `SelectField`, `Badge`, `Tag`, `Modal`, `EmptyState`, `TextField`), modo `sin-blur` para hardware modesto y guía en `DISENO.md`. | 🟣 **Mergeado** |
| **[#3](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/pull/3)** | `agente-a-catalogo` | **A (Catálogo)** | Catálogo responsive, buscador de texto y código de barras, filtros combinables, soporte offline con IndexedDB y exportación a Excel (RF-01 a RF-06). | 🟣 **Mergeado** |
| **[#4](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/pull/4)** | `agente-b-roles` | **B (Roles y Auditoría)** | Panel `ClassifierManager` (RF-03) + migración SQL `20260923000001` con tabla `missing_items`, RLS y triggers de auditoría en 5 tablas (RF-49/50, RF-58). | 🟣 **Mergeado** |
| **[#5](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/pull/5)** | `agente-c-faltantes` | **C (Faltantes y Reposición)** | Reporte de faltantes offline (RF-49), lista de reposición agrupada por proveedor con contacto (RF-50) e ingreso rápido de mercadería con lector de barras y alta de lotes (RF-51). | 🟣 **Mergeado** |

### API del sistema de diseño (estandarizada en español)

```tsx
// Button — variant: "primario" | "secundario" | "fantasma" | "peligro"
<Button variant="primario">Guardar</Button>

// Badge — tone: "neutro" | "exito" | "aviso" | "error"
<Badge tone="exito">Activo</Badge>

// SelectField — usa children (<option>), NO prop options
<SelectField label="Marca" value={v} onChange={e => setV(e.target.value)}>
  <option value="1">Del local</option>
</SelectField>

// EmptyState — prop title + children, acción opcional
<EmptyState title="Sin productos" action={<Button variant="primario">Nuevo</Button>}>
  Agregá el primero desde aquí.
</EmptyState>

// TextField — extiende InputHTMLAttributes, onChange ES evento nativo
<TextField label="Nombre" value={v} onChange={e => setV(e.target.value)} />
```

---

## 🚧 FASE 2 — EN CURSO (QA FIXES): STOCK, LOTES Y FRACCIONAMIENTO

La Fase 2 se encuentra en etapa de corrección de QA. El Agente E ya fue mergeado. Los Agentes F y G deben corregir los fallos marcados en `QA_SEGUIMIENTO.md` antes de avanzar.

| Agente | Qué construye | RFs asociados | QA / Criterio de aceptación |
|---|---|---|---|
| **E - Lotes y vencimientos** | Descuento automático por FEFO y vencimiento efectivo | RF-07 a RF-10, RF-56, RF-57 | Al vender o fraccionar, descuenta primero del lote que vence antes, sin que el usuario lo elija. Archivar un producto no borra sus ventas pasadas. |
| **F - Fraccionamiento y granel** | Conversión de bolsas cerradas a granel y bolsitas, mermas | RF-11 a RF-17b | Fraccionar 1000 g en bolsitas de 150 g dejando 100 g sobrantes registra la merma correctamente. Solo una bolsa granelera abierta por producto. |
| **G - Códigos de barra propios** | ✅ Generación y renderizado de EAN-13 interno | RF-18 a RF-23 | Un código EAN-13 generado por el sistema se imprime y lee con escáner físico. |

---

## 📦 FASE 3 — PRÓXIMO OBJETIVO: CAJA, OFFLINE Y BACKUPS

La Fase 3 es la etapa más sensible y se enfocará en el módulo de ventas de salón (Punto de Venta/Caja), robustez en la sincronización offline y persistencia de seguridad. No iniciar el desarrollo de la Fase 3 hasta que los Pull Requests de los Agentes F y G de la Fase 2 sean aprobados y fusionados a `main`.

| Agente | Qué construye | RFs asociados | QA / Criterio de aceptación |
|---|---|---|---|
| **H - Ventas y caja** | Punto de venta, carrito, medios de pago | RF-31 a RF-33 | El cierre de caja separa bien el total por medio de pago. Con la balanza sin conectar, ingresar el peso a mano calcula el importe correcto. |
| **I - Modo offline y sincronización** | Resiliencia extrema offline y colas de trabajo | RF-34 a RF-40 | Apagar la notebook de golpe con operaciones pendientes no pierde ninguna al reiniciar. Ventas simultáneas offline no se pisan. |
| **J - Backups** | Copias de seguridad automáticas | RF-41 a RF-44 | Restaurar una copia de seguridad completa devuelve los datos. El backup automático corre solo al cerrar caja. |
| **K - Clientes y fiado** | Cuentas corrientes y deudores | RF-45 a RF-48 | Un fiado y un pago posterior actualizan bien el saldo. Funciona sin conexión y se sincroniza después. |

---

## ⚠️ REGLAS VIGENTES PARA AGENTES (de AGENTS.md)

- **Nadie escribe directo en `main`** — crear una rama por feature y abrir Pull Request.
- **El esquema SQL es la fuente de verdad** — tablas en inglés, migraciones incrementales idempotentes.
- **Costos y márgenes NUNCA en el frontend de empleado** — enforcement a nivel de RLS y tipos.
- **Convención**: tablas de BD en inglés; componentes UI y tokens en español.

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
| 2026-09-23 00:29 | Antigravity | PR #5: Agente C abierto (`agente-c-faltantes`) |
| 2026-09-23 00:40 | Antigravity | QA fino aplicado a PR #2 (accesibilidad, `useId`, modo `sin-blur` CSS) |
| 2026-09-23 00:43 | Antigravity | **PR #2, #3, #4 y #5 mergeados a `main`** — **FASE 1 COMPLETADA** 🎉 |
| 2026-09-23 01:45 | Antigravity | PR/Rama Agente E (`agente-e-lotes`) para Lotes, Vencimientos y FEFO |
| 2026-09-23 01:50 | Antigravity | Agente G (`agente-g-barras`) - EAN-13, validación GS1, SVG, Simulador RF-22 |
