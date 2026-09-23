# Arnés de base de datos sin Docker

Emula lo mínimo de Supabase (roles `anon`, `authenticated`, `service_role`, esquema `auth`,
`auth.uid()` y los privilegios por defecto de Supabase) sobre un PostgreSQL 16 local, aplica
todas las migraciones y corre `supabase/tests/*.sql` con `pg_prove`.

```bash
sudo apt-get install -y postgresql-16 postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl
npm run test:db:nodocker
```

Importante: los privilegios por defecto son los de Supabase, incluido que **todo objeto nuevo en
`public` queda concedido a `anon`**. Por eso este arnés detecta fugas a usuarios no logueados.

El CI sigue usando la CLI oficial (`supabase db start` + `supabase test db`); si el arnés y el CI
discrepan, manda el CI y hay que corregir el arnés.
