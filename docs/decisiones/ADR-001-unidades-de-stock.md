# ADR-001 · Unidades de stock, venta por peso y granel

**Estado:** propuesta — requiere decisión de la dueña antes de cargar el stock inicial (RF-52).
**Contexto:** QA, PR-04 (`20260923110000_contrato_venta.sql`).

## Problema

El esquema no dice en qué unidad está `stock_lots.current_quantity`. El código existente usa dos
convenciones a la vez:

- `QuickRestock` y `FractioningModal` (lote destino) cargan **unidades de la presentación**
  (bolsas, bolsitas).
- `fractioningLogic` trata el lote de origen a granel como **gramos**.

`process_offline_sale` descuenta `sale_items.quantity` de los lotes de esa misma presentación. Si las
dos cosas no usan la misma unidad, el stock queda mal por un factor de 1000.

## Regla adoptada en el PR-04

1. `sale_items.quantity` y `stock_lots.current_quantity` están **en unidades de la presentación**.
2. Una presentación con `sold_by_weight = true` se vende pesando: la caja pide gramos (o ml) y envía
   `quantity = peso / base_quantity`, con `unit_price = sale_price` (precio de la presentación).
   Ejemplo: "Lentejas granel por kg" (`base_quantity = 1000`, `sale_price = 3000`); 350 g →
   `quantity = 0.35`, subtotal `1050`.
3. Para que el granel funcione con el fraccionamiento actual (que trabaja en gramos), la presentación
   a granel se crea con **`base_quantity = 1`** ("granel por gramo") y precio por gramo; la caja
   muestra el precio por kilo multiplicando por 1000. Con esa carga, la regla 1 y el fraccionamiento
   usan la misma unidad (gramos).

## Qué tiene que decidir la dueña

- Confirmar la opción 3 (granel por gramo). La alternativa es cambiar el fraccionamiento para que
  convierta entre gramos y la presentación; es más código y más riesgo.
- Revisar qué presentaciones quedaron marcadas `sold_by_weight` por el relleno automático (nombre
  que contiene "granel") y corregir las que falten o sobren.

## Consecuencias

- Hasta que exista una pantalla para marcar `sold_by_weight`, se edita desde Supabase Studio.
  Queda como tarea en `PR_PENDIENTES`.
- El test `venta_contrato_test.sql` fija la regla 1; cualquier cambio de convención tiene que
  cambiar ese test primero.
