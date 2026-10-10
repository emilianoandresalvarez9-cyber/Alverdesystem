# Arnés de base de datos sin Docker

Emula lo mínimo de Supabase (roles `anon`, `authenticated`, `service_role`, esquema `auth`,
`auth.uid()` y los privilegios por defecto de Supabase) sobre un PostgreSQL 16 local, aplica
todas las migraciones y corre `supabase/tests/*.sql` con `pg_prove`.

```bash
sudo apt-get install -y postgresql-16 postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl
npm run test:db:nodocker
```

Importante: el arnés usa los privilegios **del proyecto de producción**: los objetos nuevos en
`public` **no** quedan concedidos ni a `anon` ni a `authenticated`. Cada migración tiene que dar sus
`GRANT` explícitos. Con los privilegios automáticos de Supabase las pruebas pasaban y producción
fallaba con "permission denied" (stock_warnings, is_api_role, credit_movement_delta, octubre 2026).
El CI corre este modo en el job `database-strict`.

Para probar con privilegios automáticos (como un proyecto Supabase nuevo con exposición
automática): `PGQA_LENIENT=1 npm run test:db:nodocker`. Sirve para detectar fugas a `anon`.

El CI corre las dos variantes: `database` (CLI oficial de Supabase, privilegios automáticos) y
`database-strict` (este arnés, como producción). Tienen que pasar las dos.

## Tipos de la base para TypeScript

Con la base levantada, `npm run gen:types` regenera `src/shared/supabase/database.types.ts`
desde el catálogo de Postgres (mismo formato que `supabase gen types typescript`). Correrlo
después de cada migración nueva y commitear el resultado junto con la migración.

## No borrar esta carpeta

`npm run test:db:nodocker` depende de ella y `npm run qa:guard` falla si un script de
`package.json` apunta a un archivo que no existe. Ya se borró una vez como "basura".
