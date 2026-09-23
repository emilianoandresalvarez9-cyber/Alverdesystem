# QA_SEGUIMIENTO.md — Ruta de Verificación y Auditoría de Calidad

> **Documento para el agente de QA (Codex / Claude / Auditor).**  
> Este archivo detalla cada tarea completada en Fase 0 y Fase 1, sus archivos asociados, los requisitos cubiertos y los pasos exactos para verificar su correcto funcionamiento.

---

## 🛠️ 1. Comandos de Verificación Automatizada

Antes de la revisión manual, el agente de QA debe ejecutar la suite de comprobaciones rápidas en la raíz del proyecto:

```bash
# 1. Instalar dependencias
npm install

# 2. Comprobar que TypeScript compila en modo estricto sin errores
npm run typecheck

# 3. Comprobar pruebas unitarias (deben pasar 2/2 sin timeouts de IndexedDB)
npm test

# 4. Comprobar que el build MPA genera los 3 HTMLs (login, catalog, admin)
npm run build
```

**Criterio de Aceptación Global:**
- `npm test`: 2 pruebas pasando (`persists operations...`, `removes an event from pending...`). Duración < 3 segundos.
- `npm run typecheck`: código de salida 0, sin errores ni `any` indebidos.
- `npm run build`: genera carpeta `dist/` con `index.html`, `catalog.html` y `admin.html`.

---

## 📋 2. Fase 0 — Cimientos, Base de Datos y Cola Offline

### Tarea 0.1: Desduplicación del Esquema SQL
- **Problema previo:** Existían dos migraciones en conflicto (`20260922000001` en español y `20260922060000` en inglés) que duplicaban tablas como `profiles`.
- **Solución:** Se vació `20260922000001_fase0_schema.sql` (solo comentarios) y se dejó como único esquema canónico `20260922060000_phase_0_foundation.sql`.
- **Archivos:** `supabase/migrations/20260922000001_fase0_schema.sql`
- **Puntos de auditoría QA:**
  - [ ] Verificar que no existan sentencias `CREATE TABLE` duplicadas entre migraciones.
  - [ ] Comprobar que todos los nombres de tablas y columnas canónicos están en inglés.

### Tarea 0.2: Smoke Test de Base de Datos
- **Problema previo:** `supabase/tests/smoke_test.sql` verificaba tablas con nombres en español (`marcas`, `ventas`), haciendo fallar el CI de base de datos.
- **Solución:** Se actualizó `smoke_test.sql` con los 19 nombres reales de tablas en inglés, verificación de existencia de la vista `employee_catalog`, comprobación de ausencia de costos en dicha vista (RNF-04) y verificación de activación de RLS.
- **Archivos:** `supabase/tests/smoke_test.sql`
- **Puntos de auditoría QA:**
  - [ ] Verificar que la vista `employee_catalog` no contenga columnas como `cost`, `purchase_cost` ni `price_multiplier`.
  - [ ] Verificar que `stock_lots`, `profiles`, `sales` y `supplier_products` tengan `rowsecurity = true`.

### Tarea 0.3: Eliminación de Fuga de Conexiones en IndexedDB (Race Condition)
- **Problema previo:** `npm test` fallaba con `IndexedDB quedó bloqueada durante la limpieza` (timeout de 5000ms).
- **Causa raíz:** `backup.ts` abría una conexión independiente a IndexedDB en cada llamada a `readDirectory()` y `saveDirectory()` sin llamar a `db.close()`. Cuando el test ejecutaba `resetOfflineStorageForTests()`, la base quedaba bloqueada.
- **Solución:**
  1. En `src/shared/offline/backup.ts`: se agregó `db.close()` explícito tanto en `transaction.oncomplete` como en `transaction.onerror`.
  2. En `src/shared/offline/queue.ts`: se introdujo la variable `pendingMirror = mirrorPendingQueue()` y un `await pendingMirror` previo a cerrar la conexión en `resetOfflineStorageForTests()`.
- **Archivos:** `src/shared/offline/backup.ts`, `src/shared/offline/queue.ts`
- **Puntos de auditoría QA:**
  - [ ] Ejecutar `npm test` consecutivamente múltiples veces: no debe existir bloqueo ni timeout.

---

## 🎨 3. Fase 1 — Sistema de Diseño (Agente D · PR #2)

- **Requisitos asociados:** RNF-06 (Glassmorfismo), RNF-07 (View Transitions), RNF-08 (Rendimiento modesto), RNF-09 (Diseño modular).
- **Archivos principales:**
  - `src/styles/tokens.css` (tokens de color, espaciado, radios y movimiento)
  - `src/styles/global.css` (estilos base, modo `sin-blur`, fallbacks)
  - `src/shared/ui/` (`Button.tsx`, `GlassCard.tsx`, `TextField.tsx`, `SelectField.tsx`, `Badge.tsx`, `Tag.tsx`, `EmptyState.tsx`, `Modal.tsx`)
  - `DISENO.md` (guía de uso estandarizada)
  - `demo/index.html` (muestrario estático)

### Puntos de auditoría QA:
- [ ] **Variantes en Español:** Verificar que los componentes utilicen las variantes aprobadas:
  - `Button`: `variant="primario" | "secundario" | "fantasma" | "peligro"`
  - `Badge`: `tone="neutro" | "exito" | "aviso" | "error"`
  - `Tag`: `<button>` conmutable con atributo `aria-pressed={active}`
- [ ] **Accesibilidad:**
  - `Modal.tsx` debe enlazar el título con el contenedor dialog mediante `aria-labelledby` y `useId()`.
  - `Button.tsx` no debe permitir que `...rest` sobrescriba su comportamiento controlado de `type` o `disabled`.
- [ ] **Modo Hardware Modesto (sin-blur):**
  - Al colocar `<html class="sin-blur">`, las reglas `.glass` deben ejecutar `-webkit-backdrop-filter: none; backdrop-filter: none;` con fondo opaco legible.
- [ ] **Fallbacks CSS:**
  - Superficies con `color-mix()` deben tener un color de respaldo sólido previo (ej. `rgba(...)`).

---

## 📦 4. Fase 1 — Catálogo de Productos (Agente A · PR #3)

- **Requisitos asociados:** RF-01 (Acceso desde celular), RF-02 (3 ejes: Marca/Rubro/Etiqueta), RF-04 (Filtros combinables), RF-05 (Exportar a Excel), RF-06 (Marca Del local), RNF-04 (Privacidad de costos).
- **Archivos principales:**
  - `src/modules/catalog/types.ts`
  - `src/modules/catalog/useCatalog.ts`
  - `src/modules/catalog/ProductCard.tsx`
  - `src/modules/catalog/CatalogFiltersBar.tsx`
  - `src/modules/catalog/exportCatalog.ts`
  - `src/pages/CatalogPage.tsx`
  - `src/styles/catalog.css`

### Puntos de auditoría QA:
- [ ] **Búsqueda y Filtros Combinables (RF-04):**
  - La función `filterProducts()` en `useCatalog.ts` debe filtrar simultáneamente por texto (nombre, código fabricante, código interno de presentación), marca, rubro y etiqueta.
- [ ] **Exportación a Excel (RF-05):**
  - `exportCatalogToExcel()` debe generar un archivo `.csv` con prefijo BOM UTF-8 (`\uFEFF`) y delimitadores `;` para que Excel en español lo abra con tildes y caracteres especiales correctos.
- [ ] **Protección de Datos (RNF-04):**
  - Comprobar que en `types.ts` y en `ProductCard.tsx` no existe ningún campo de costo (`purchase_cost`, `cost`, `margin`). Solo se expone `sale_price`.
- [ ] **Resiliencia Offline:**
  - Si `navigator.onLine` es falso o la llamada a Supabase falla, el catálogo debe leer el snapshot guardado en IndexedDB (`loadCatalogSnapshot`) y mostrar el aviso visual correspondiente.

---

## 🛡️ 5. Fase 1 — Roles, Clasificadores y Auditoría (Agente B · PR #4)

- **Requisitos asociados:** RF-03 (Administrador gestiona marcas/rubros/etiquetas), RF-49/50 (Estructura de faltantes), RF-58 (Auditoría de cambios).
- **Archivos principales:**
  - `supabase/migrations/20260923000001_fase1_faltantes_auditoria.sql`
  - `src/modules/admin/ClassifierManager.tsx`

### Puntos de auditoría QA:
- [ ] **Migración SQL de Faltantes y Auditoría:**
  - La tabla `public.missing_items` debe tener RLS habilitado:
    - Autenticados pueden hacer `SELECT` e `INSERT`.
    - Solo usuarios con rol `administrator` en `public.profiles` pueden hacer `UPDATE` (resolver).
  - La función `public.log_audit_change()`:
    - Debe estar asociada con triggers `AFTER UPDATE` a `products`, `brands`, `categories`, `labels` y `product_presentations`.
    - Debe ignorar campos de control técnico (`id`, `created_at`, `updated_at`).
    - Debe insertar en `public.audit_history` los valores anteriores y nuevos en formato JSONB con el `user_id` de la sesión.
- [ ] **Componente `ClassifierManager` (RF-03):**
  - Debe permitir crear, renombrar (edición en línea) y archivar (`archived_at = now()`) marcas, rubros y etiquetas.
  - Si el tipo es `category`, debe permitir seleccionar un rubro padre opcional (`parent_id`).
  - Debe consumir los componentes de UI (`SelectField`, `Badge`, `EmptyState`, `Button`) con su API estandarizada.

---

## ⚡ 6. Fase 1 — Faltantes y Reposición (Agente C · PR #5)

- **Requisitos asociados:** RF-49 (Marcar faltante), RF-50 (Lista agrupada por proveedor), RF-51 (Ingreso rápido con lector de barras).
- **Archivos principales:**
  - `src/modules/restock/types.ts`
  - `src/modules/restock/QuickRestock.tsx`
  - `src/modules/restock/RepositionList.tsx`
  - `src/modules/restock/FaltantesPage.tsx`

### Puntos de auditoría QA:
- [ ] **Ingreso Rápido de Mercadería (RF-51):**
  - Al escanear o tipear un código de barras en `QuickRestock.tsx`:
    1. Debe buscar en `product_presentations.internal_barcode`.
    2. Si no lo encuentra, debe buscar en `products.manufacturer_barcode`.
  - Al confirmar el ingreso, debe insertar el nuevo lote en `public.stock_lots` y el respectivo movimiento en `public.stock_movements` con `kind = 'receipt'`.
- [ ] **Lista de Reposición por Proveedor (RF-50):**
  - `RepositionList.tsx` debe consultar `missing_items` pendientes (`resolved = false`) e inferir el proveedor asignado o preferido (`is_preferred`).
  - La lista debe renderizarse agrupada visualmente por proveedor con sus datos de contacto.
  - El botón "Marcar Resuelto" debe actualizar `resolved = true`.
- [ ] **Reporte Offline de Faltantes (RF-49):**
  - Si el dispositivo pierde conexión, `reportMissingItem` debe recurrir a `enqueueOperation({ kind: "stock_movement", payload: ... })` en IndexedDB.

---

## 📊 7. Matriz de Trazabilidad RNF / RF

| Requisito | Descripción | Implementación | Verificación QA |
|---|---|---|---|
| **RF-01** | Catálogo en celular | `CatalogPage.tsx`, `catalog.css` | Grilla responsiva a 320px |
| **RF-02** | 3 ejes de catálogo | `types.ts`, `useCatalog.ts` | Marca, Rubro y Etiquetas independientes |
| **RF-03** | ABM clasificadores | `ClassifierManager.tsx` | Crear, renombrar y soft-delete (archivar) |
| **RF-04** | Filtros combinables | `useCatalog.ts` (`filterProducts`) | Búsqueda + 3 filtros simultáneos |
| **RF-05** | Exportar a Excel | `exportCatalog.ts` | CSV generado con BOM UTF-8 |
| **RF-06** | Marca Del local | Migración Fase 0 (`brands`) | Marca tratada sin hardcode |
| **RF-49** | Marcar faltante | `FaltantesPage.tsx` | Inserción en `missing_items` / offline queue |
| **RF-50** | Reposición agrupada | `RepositionList.tsx` | Agrupado por proveedor con contacto |
| **RF-51** | Ingreso rápido barras | `QuickRestock.tsx` | Escaneo interno/fabricante y alta de lote |
| **RF-58** | Auditoría de cambios | Trigger `log_audit_change()` | Inserción en `audit_history` tras UPDATE |
| **RNF-04** | Protección de costos | RLS + Types + Views | Cero campos de costo en vistas de empleado |
| **RNF-06** | Glassmorfismo | `tokens.css`, `global.css` | `--glass-blur: 14px`, superficies translúcidas |
| **RNF-08** | Hardware modesto | `html.sin-blur` | `backdrop-filter: none` sin lag |
| **RNF-10** | Sin secretos en git | `.env.example`, `.gitignore` | Claves solo en variables de entorno |

---

## ✍️ Formato de Veredicto Esperado del Agente QA

Al completar la revisión, el agente QA debe responder con:
1. **Resultado de comandos:** Estado de `npm test`, `npm run typecheck`, `npm run build`.
2. **Hallazgos:** Observaciones o discrepancias encontradas (si las hubiera).
3. **Veredicto:** `APPROVED` (Aprobado para iniciar Fase 2) o `CHANGES REQUESTED` (especificando los archivos y líneas a ajustar).
