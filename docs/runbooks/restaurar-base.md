# Runbook · Restaurar la base de datos completa

La app **no** restaura la base desde el navegador. La restauración anterior escribía tabla por
tabla, sin transacción: si fallaba a mitad quedaba a medias, y al volver los lotes a cantidades
viejas dejaba el stock descuadrado respecto de sus movimientos (defecto P17).

## Antes de empezar

- Lo hace una persona con acceso al proyecto de Supabase.
- Avisar en el local: mientras dura, las cajas pueden seguir **sin conexión**; sus ventas quedan
  en la cola y se envían después.

## 1. Respaldar el estado actual (aunque esté roto)

```bash
supabase link --project-ref <REF>
supabase db dump --linked -f antes_de_restaurar_esquema.sql
supabase db dump --linked --data-only -f antes_de_restaurar_datos.sql
```

## 2. Ensayar en una base local

```bash
supabase start && supabase db reset          # base limpia con todas las migraciones
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" --single-transaction -v ON_ERROR_STOP=1 \
  -c "set session_replication_role = replica" -f <respaldo_datos>.sql
```

`session_replication_role = replica` evita que se disparen los triggers de auditoría y de stock
al cargar datos históricos. Abrir la app local y comprobar ventas, stock y saldos de fiado.

## 3. Restaurar en el proyecto online

El mismo comando del paso 2 contra la conexión del proyecto (Project Settings → Database), con
`--single-transaction`: si algo falla, no queda nada a medias.

## 4. Después

- Abrir la caja en cada equipo: las ventas pendientes de la cola se envían solas.
- Si un equipo perdió su cola: Administración → Configuración → "Recuperar desde un respaldo",
  con el archivo de la segunda copia o del cierre de caja. No duplica ventas.

## Qué no sirve para restaurar

La "copia completa" que descarga la app es una exportación de datos para guardar fuera de la
notebook y abrir en Excel. No reemplaza a `supabase db dump`, que también guarda el esquema.
