# AI Hand-off: Estado del repositorio y revisión de integridad

Repositorio: `emilianoandresalvarez9-cyber/Alverdesystem`
PR principal relevante: `#2` (`Agente D: Sistema de diseño — tokens, componentes glass y guía de uso`)

## Objetivo de este archivo

Este documento reúne:

- la lógica actual de sincronización offline,
- la migración principal de Supabase,
- pruebas SQL y puntos críticos que una IA (Gemini, Claude, Copilot, etc.) debe revisar,
- instrucciones concretas para análisis y aprobación.

No incluir secretos, claves, tokens o credenciales.

---

## 1) Archivo: `src/shared/offline/sync.ts`

Contenido exacto:

```ts
import { getSupabase } from "../supabase/client";
import {
  markOperationFailed,
  markOperationSynced,
  pendingOperations,
  saveCatalogSnapshot
} from "./queue";

export type SyncResult = {
  synchronized: number;
  failed: number;
};

export async function synchronizePendingOperations(): Promise<SyncResult> {
  if (!navigator.onLine) return { synchronized: 0, failed: 0 };

  const operations = await pendingOperations();
  let synchronized = 0;
  let failed = 0;

  for (const operation of operations) {
    const { error } = await getSupabase().rpc("apply_offline_operation", {
      p_operation: operation
    });

    if (error) {
      failed += 1;
      await markOperationFailed(operation.localId, error.message);
      continue;
    }

    synchronized += 1;
    await markOperationSynced(operation.localId);
  }

  return { synchronized, failed };
}

export async function refreshEmployeeCatalog(): Promise<unknown[]> {
  const { data, error } = await getSupabase()
    .from("employee_catalog")
    .select("*")
    .order("product_name", { ascending: true });

  if (error) throw error;
  const rows = data ?? [];
  await saveCatalogSnapshot(rows);
  return rows;
}

export function startOfflineSynchronization(): () => void {
  const sync = () => void synchronizePendingOperations().catch((error: unknown) => {
    console.warn("La sincronización quedará para el próximo reintento.", error);
  });

  addEventListener("online", sync);
  sync();

  return () => removeEventListener("online", sync);
}
```

### Qué revisar aquí

- `synchronizePendingOperations()` intenta procesar todas las operaciones pendientes secuencialmente.
- No hay backoff ni reintentos con retry strategy.
- No hay validación profunda del payload antes de enviar al RPC.
- No hay diferencia explícita entre operación válida, no soportada y fallida por negocio.
- `refreshEmployeeCatalog()` usa una vista restringida (`employee_catalog`) y guarda una snapshot local.
- `startOfflineSynchronization()` dispara la sincronización al cargar y al volver a conectarse.

---

## 2) Migración SQL principal: `supabase/migrations/20260922060000_phase_0_foundation.sql`

Contenido relevante (extracto):

```sql
-- Alverde · Fase 0
-- This migration is the source of truth for the operational data model.
-- Apply with: supabase db push (after linking the intended project).

create extension if not exists pgcrypto;

create type public.app_role as enum ('administrator', 'employee');
create type public.base_unit as enum ('gram', 'millilitre', 'unit');
create type public.stock_lot_status as enum ('open', 'closed');
create type public.sale_status as enum ('closed', 'voided');
create type public.payment_method as enum ('cash', 'transfer', 'qr', 'credit');
create type public.stock_movement_kind as enum (
  'receipt', 'sale', 'portioning', 'waste', 'adjustment', 'discard'
);
create type public.credit_movement_kind as enum ('charge', 'payment', 'adjustment');
create type public.offline_operation_kind as enum ('sale', 'stock_movement', 'credit_movement');

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  address text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.registers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (branch_id, name)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) > 0),
  role public.app_role not null default 'employee',
  branch_id uuid references public.branches(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.categories(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (parent_id, name)
);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  manufacturer_barcode text unique,
  brand_id uuid references public.brands(id),
  category_id uuid references public.categories(id),
  base_unit public.base_unit not null,
  price_multiplier numeric(8, 3) check (price_multiplier > 0),
  open_shelf_life_days integer check (open_shelf_life_days > 0),
  label_text text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_labels (
  product_id uuid not null references public.products(id) on delete cascade,
  label_id uuid not null references public.labels(id),
  primary key (product_id, label_id)
);

create table public.product_presentations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  name text not null check (char_length(trim(name)) > 0),
  base_quantity numeric(14, 3) not null check (base_quantity > 0),
  internal_barcode text unique,
  sale_price numeric(14, 2) not null default 0 check (sale_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (internal_barcode is null or internal_barcode ~ '^[0-9]{13}$')
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  contact text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name)
);

create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  supplier_id uuid not null references public.suppliers(id),
  supplier_product_code text,
  cost numeric(14, 2) not null check (cost >= 0),
  last_purchase_at timestamptz,
  is_primary boolean not null default false,
  unique (product_id, supplier_id)
);

create table public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.product_presentations(id),
  supplier_id uuid references public.suppliers(id),
  initial_quantity numeric(14, 3) not null check (initial_quantity >= 0),
  current_quantity numeric(14, 3) not null check (current_quantity >= 0),
  purchase_cost numeric(14, 2) not null check (purchase_cost >= 0),
  received_at timestamptz not null default now(),
  manufacturer_expiry_date date,
  opened_at timestamptz,
  portioned_at timestamptz,
  status public.stock_lot_status not null default 'closed',
  created_at timestamptz not null default now(),
  check (current_quantity <= initial_quantity)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  phone text,
  credit_limit numeric(14, 2) check (credit_limit >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null unique,
  branch_id uuid not null references public.branches(id),
  register_id uuid not null references public.registers(id),
  user_id uuid not null references public.profiles(id),
  customer_id uuid references public.customers(id),
  payment_method public.payment_method not null,
  status public.sale_status not null default 'closed',
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  presentation_id uuid not null references public.product_presentations(id),
  lot_id uuid references public.stock_lots(id),
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  local_id uuid not null unique
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null unique,
  kind public.stock_movement_kind not null,
  product_id uuid not null references public.products(id),
  lot_id uuid references public.stock_lots(id),
  quantity numeric(14, 3) not null check (quantity <> 0),
  reason text,
  user_id uuid not null references public.profiles(id),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.credit_movements (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null unique,
  customer_id uuid not null references public.customers(id),
  sale_id uuid references public.sales(id),
  kind public.credit_movement_kind not null,
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  user_id uuid not null references public.profiles(id),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.audit_history (
  id bigint generated always as identity primary key,
  entity text not null,
  entity_id uuid not null,
  field text not null,
  old_value jsonb,
  new_value jsonb,
  user_id uuid references public.profiles(id),
  occurred_at timestamptz not null default now()
);

create table public.offline_operations (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null,
  device_id uuid not null,
  kind public.offline_operation_kind not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  received_by uuid not null references public.profiles(id),
  unique (device_id, local_id)
);
```

### Bloque crítico: `apply_offline_operation`

```sql
create or replace function public.apply_offline_operation(p_operation jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id uuid := (p_operation ->> 'localId')::uuid;
  v_device_id uuid := (p_operation ->> 'deviceId')::uuid;
  v_kind public.offline_operation_kind := (p_operation ->> 'kind')::public.offline_operation_kind;
  v_occurred_at timestamptz := coalesce((p_operation ->> 'createdAt')::timestamptz, now());
  v_payload jsonb := p_operation -> 'payload';
  v_sale_id uuid;
  v_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.offline_operations(local_id, device_id, kind, payload, occurred_at, received_by)
  values (v_local_id, v_device_id, v_kind, v_payload, v_occurred_at, auth.uid())
  on conflict (device_id, local_id) do nothing;

  if not found then
    return true;
  end if;

  if v_kind = 'sale' then
    insert into public.sales(
      local_id, branch_id, register_id, user_id, customer_id, payment_method, occurred_at
    )
    values (
      v_local_id,
      (v_payload ->> 'branchId')::uuid,
      (v_payload ->> 'registerId')::uuid,
      auth.uid(),
      nullif(v_payload ->> 'customerId', '')::uuid,
      (v_payload ->> 'paymentMethod')::public.payment_method,
      v_occurred_at
    )
    returning id into v_sale_id;

    for v_item in select value from jsonb_array_elements(coalesce(v_payload -> 'items', '[]'::jsonb))
    loop
      insert into public.sale_items(local_id, sale_id, presentation_id, lot_id, quantity, unit_price)
      values (
        coalesce(nullif(v_item ->> 'localId', '')::uuid, gen_random_uuid()),
        v_sale_id,
        (v_item ->> 'presentationId')::uuid,
        nullif(v_item ->> 'lotId', '')::uuid,
        (v_item ->> 'quantity')::numeric,
        (v_item ->> 'unitPrice')::numeric
      );
    end loop;
  elsif v_kind = 'stock_movement' then
    insert into public.stock_movements(local_id, kind, product_id, lot_id, quantity, reason, user_id, occurred_at)
    values (
      v_local_id,
      (v_payload ->> 'movementKind')::public.stock_movement_kind,
      (v_payload ->> 'productId')::uuid,
      nullif(v_payload ->> 'lotId', '')::uuid,
      (v_payload ->> 'quantity')::numeric,
      v_payload ->> 'reason',
      auth.uid(),
      v_occurred_at
    );
  elsif v_kind = 'credit_movement' then
    insert into public.credit_movements(local_id, customer_id, sale_id, kind, amount, note, user_id, occurred_at)
    values (
      v_local_id,
      (v_payload ->> 'customerId')::uuid,
      nullif(v_payload ->> 'saleId', '')::uuid,
      (v_payload ->> 'movementKind')::public.credit_movement_kind,
      (v_payload ->> 'amount')::numeric,
      v_payload ->> 'note',
      auth.uid(),
      v_occurred_at
    );
  end if;

  return true;
end;
$$;
```

### Observación clave

Esta función inserta operaciones en `offline_operations` y luego re-inserta la venta, movimiento o crédito. Sin embargo, no se ve una actualización explícita de `stock_lots.current_quantity` ni un ajuste de inventario cuando se procesa una venta. Eso puede ser un problema de integridad si ese cálculo no está implementado en otra parte del sistema.

---

## 3) SQL de pruebas: `supabase/tests/001_foundation_smoke.sql`

```sql
-- Run after migrations against a disposable local Supabase database.
do $$
declare
  required_tables text[] := array[
    'branches', 'registers', 'profiles', 'brands', 'categories', 'labels',
    'products', 'product_labels', 'product_presentations', 'suppliers',
    'supplier_products', 'stock_lots', 'sales', 'sale_items', 'stock_movements',
    'customers', 'credit_movements', 'audit_history', 'offline_operations'
  ];
  table_name text;
begin
  foreach table_name in array required_tables loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and tables.table_name = table_name
    ) then
      raise exception 'Missing required table: %', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stock_lots'
  ) then
    raise exception 'stock_lots must be protected by RLS policies';
  end if;

  if not exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'employee_catalog'
  ) then
    raise exception 'Missing restricted employee catalogue view';
  end if;
end $$;
```

---

## 4) SQL de pruebas: `supabase/tests/smoke_test.sql`

```sql
-- Smoke test: verifica que las entidades y políticas esenciales existen
-- Correr con: supabase db reset (aplica migración y ejecuta seeds)

-- Verificar tablas principales
do $$ begin
  assert (select count(*) from information_schema.tables
    where table_schema = 'public'
    and table_name in (
      'marcas','rubros','etiquetas','sucursales','puestos','profiles',
      'proveedores','productos','producto_etiquetas','presentaciones',
      'proveedor_productos','lotes','clientes','ventas','venta_items',
      'movimientos_stock','movimientos_fiado','historial_cambios',
      'historial_precios','faltantes'
    )
  ) = 20,
  'Faltan tablas en el esquema';
end $$;

-- Verificar vista employee_catalog
do $$ begin
  assert (select count(*) from information_schema.views
    where table_schema = 'public' and table_name = 'employee_catalog'
  ) = 1,
  'Falta la vista employee_catalog';
end $$;

-- Verificar que la vista NO expone costo_compra
do $$ begin
  assert (select count(*) from information_schema.columns
    where table_schema = 'public'
    and table_name = 'employee_catalog'
    and column_name = 'costo_compra'
  ) = 0,
  'La vista employee_catalog expone costo_compra — falla de seguridad';
end $$;

-- Verificar función RPC
do $$ begin
  assert (select count(*) from pg_proc
    where proname = 'apply_offline_operation'
    and pronamespace = 'public'::regnamespace
  ) = 1,
  'Falta la función RPC apply_offline_operation';
end $$;

-- Verificar datos iniciales
do $$ begin
  assert (select count(*) from public.marcas where nombre = 'Del local') = 1,
  'Falta la marca Del local';

  assert (select count(*) from public.sucursales) >= 1,
  'Falta al menos una sucursal';

  assert (select count(*) from public.puestos) >= 1,
  'Falta al menos un puesto';
end $$;

raise notice 'Smoke test OK: esquema, vista, RPC y datos iniciales verificados.';
```

### Observación

Los nombres de tablas aquí parecen no coincidir exactamente con la migración principal. Debe validarse cuál es la versión verdadera del esquema activo.

---

## 5) Instrucciones para la IA que va a revisar esto

### Preguntas clave que debe responder la IA

1. ¿La lógica de `apply_offline_operation` es idempotente y segura para reintentos?
2. ¿`sync.ts` reintenta fallos de forma adecuada o solo marca error?
3. ¿Se actualiza `stock_lots.current_quantity` correctamente al procesar ventas o movimientos?
4. ¿La vista `employee_catalog` realmente no expone costos ni márgenes?
5. ¿Las políticas RLS restringen bien lectura/escritura por rol?
6. ¿Hay superposición de nombres de tablas/columnas entre migraciones y tests?
7. ¿La migración principal y las pruebas SQL están alineadas con el modelo real del proyecto?

### Instrucciones de trabajo

- No modificar el código sin primero validar el esquema actual.
- No incluir secretos ni `.env` ni tokens en el análisis.
- No asumir que `authenticated` tiene permisos adecuados sin leer las policies RLS.
- Priorizar integridad de datos y trazabilidad sobre velocidad.
- Revisar si las operaciones offline deben ser append-only, con deduplicación por `device_id + local_id`.
- Validar la consistencia entre `stock_lots`, `sales`, `sale_items`, `stock_movements` y `audit_history`.

### Criterio de aprobación

La IA puede dar approve final solo si responde afirmativamente estas preguntas:

- ¿Es idempotente la sincronización?
- ¿Hay un control de inventario consistente?
- ¿Las políticas RLS cubren acceso por rol?
- ¿No hay fugas de datos a empleados?
- ¿La migración y las pruebas SQL coinciden con la versión en funcionamiento?

---

## 6) Resumen del estado actual

### Lo que está bien

- Hay una propuesta clara de modelo de base de datos.
- Hay una función `apply_offline_operation` con deduplicación por `device_id + local_id`.
- Hay una vista restringida `employee_catalog`.
- Hay smoke tests para validar tablas y funciones.

### Lo que requiere revisión

- La sincronización offline no tiene backoff ni manejo de reintentos robusto.
- No se ve evidencia clara de descuento de stock al procesar ventas.
- Hay una posible inconsistencia entre nombres de tablas en pruebas SQL y migración.
- Las políticas RLS deben comprobarse a fondo antes de approval final.
- `sync.ts` y la migración deben validarse contra el esquema real activo en Supabase.

---

## 7) Mensaje directo para compartir con otra IA

> Necesito que revises la integridad de datos y la lógica de sincronización offline de este repositorio. Este archivo contiene el código relevante y el contexto. 
>
> Archivos prioritarios:
> - `src/shared/offline/sync.ts`
> - `supabase/migrations/20260922060000_phase_0_foundation.sql`
> - `supabase/tests/001_foundation_smoke.sql`
> - `supabase/tests/smoke_test.sql`
> - `supabase/seed.sql`
>
> Haz una revisión centrada en:
> 1. idempotencia,
> 2. RLS y permisos,
> 3. consistencia de stock y lotes,
> 4. manejo de reintentos en sincronización offline,
> 5. inconsistencias entre migraciones y tests.
>
> No toques secretos ni claves. No asumas permisos por defecto. Necesito una recomendación precisa de refactorización o approve definitivo.

---

## 8) URLs útiles

- Repositorio: https://github.com/emilianoandresalvarez9-cyber/Alverdesystem
- PR #2: https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/pull/2
- `sync.ts`: https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/blob/main/src/shared/offline/sync.ts
- migración principal: https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/blob/main/supabase/migrations/20260922060000_phase_0_foundation.sql
- smoke tests: https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/tree/main/supabase/tests

---

## 9) Nota final

Este archivo está pensado para ser usado como hand-off a otra IA para análisis, revisión o aprobación. Se puede adjuntar como archivo `.md` o copiar/pegar en un chat externo. No reemplaza la validación real de Supabase ni la revisión final del código en producción.
