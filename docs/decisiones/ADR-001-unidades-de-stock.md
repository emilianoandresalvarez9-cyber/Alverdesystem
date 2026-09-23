# ADR-001 · Unidades de stock, venta por peso y granel

**Estado:** aceptada (23/09/2026, definida con el dueño). Implementada en PR-10.

## Regla

Cada **presentación** se vende de una de dos formas. Se decide por presentación, no por producto,
porque un mismo producto puede tener las dos (palitos salados a granel y en bolsitas).

| Ejemplo | Cómo se vende | `base_quantity` | `sale_price` | Stock del lote |
|---|---|---|---|---|
| Palitos salados 150 g | Por unidad: escanear suma 1 | 150 | precio de la bolsita | bolsitas |
| Palitos salados 250 g | Por unidad (otra presentación) | 250 | precio de la bolsita | bolsitas |
| Lentejas, arroz a granel | **Balanza**: la caja pide los gramos | **1** | precio **por gramo** | gramos (bolsa de 25 kg = lote de 25.000) |

- `sale_items.quantity` y `stock_lots.current_quantity` están siempre en unidades de la
  presentación. En una presentación "Balanza" esa unidad es el gramo (o mililitro).
- La dueña carga y ve **precio por kilo**; el sistema guarda precio por gramo. Como RF-29 redondea
  a múltiplos de $100 por kilo, la conversión es exacta. Se exige múltiplo de $10 por kilo.
- Fraccionar descuenta gramos de la bolsa a granel y suma unidades a la bolsita: misma unidad que
  la venta, sin conversiones.

## Esperar el peso o no

- Presentación con "Balanza": al escanear, la caja espera los gramos. Hoy los tipea quien atiende
  (RF-33). Con una balanza conectable, la interfaz de RF-33b los leerá sola.
- Sin "Balanza": la caja suma una unidad y no espera nada.
- Futuro opcional: balanzas que imprimen etiquetas con el peso dentro del código. El prefijo
  **29** queda reservado para eso; el generador de códigos internos no lo usa.

## Cómo se hace cumplir

- Base: `check (not sold_by_weight or base_quantity = 1)` y un trigger que solo permite "Balanza"
  en productos en gramos o mililitros.
- `set_presentation_scale()` (solo administradora): convertir una presentación de tamaño fijo exige
  confirmación explícita, para que una bolsita no se transforme en granel por error.
- Pantalla: Administración → Balanza.
- Tests: `supabase/tests/balanza_granel_test.sql`, `cart.test.ts`, `scalePricing.test.ts`.

## Alternativas descartadas

- **Usar una etiqueta del catálogo ("balanza")**: las etiquetas son por producto y se renombran
  para ordenar el catálogo; renombrarla desactivaría la balanza en silencio.
- **Guardar el precio por kilo y la cantidad en gramos**: cada suma de ventas tendría que saber si
  dividir por 1000; un reporte que lo olvide multiplica por mil.
