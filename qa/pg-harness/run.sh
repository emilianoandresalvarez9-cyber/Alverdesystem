#!/usr/bin/env bash
# Corre migraciones + seed + tests pgTAP contra un PostgreSQL 16 local, SIN Docker.
# Pensado para agentes en sandboxes donde `supabase start` no está disponible.
# No reemplaza al CI (que usa la CLI oficial): es una verificación previa rápida.
#
# Requisitos (Ubuntu/Debian): apt-get install postgresql-16 postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl
# Uso: bash qa/pg-harness/run.sh [ruta-del-repo]
set -euo pipefail
REPO="$(cd "${1:-.}" && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DATA="${PGQA_DATA:-/tmp/pgqa}"
export PGHOST=/tmp PGPORT="${PGQA_PORT:-55432}" PGUSER=postgres
export PGOPTIONS='-c client_min_messages=warning'

as_pg() { if [ "$(id -u)" = "0" ]; then su postgres -c "$*"; else bash -c "$*"; fi; }

if [ ! -d "$DATA" ]; then
  as_pg "$PGBIN/initdb -D $DATA -A trust -U postgres" >/dev/null
fi
if ! as_pg "$PGBIN/pg_ctl -D $DATA status" >/dev/null 2>&1; then
  as_pg "$PGBIN/pg_ctl -D $DATA -o '-k /tmp -p $PGPORT' -l /tmp/pgqa.log start" >/dev/null
  sleep 2
fi

psql -q -d postgres -c "drop database if exists alverde" -c "create database alverde"
psql -q -d alverde -c "alter database alverde set search_path = \"\$user\", public, extensions"
psql -q -v ON_ERROR_STOP=1 -d alverde -f "$HERE/supabase_stub.sql"
for f in "$REPO"/supabase/migrations/*.sql; do
  echo "== migración $(basename "$f")"
  psql -q -v ON_ERROR_STOP=1 -d alverde -f "$f"
done
[ -f "$REPO/supabase/seed.sql" ] && psql -q -v ON_ERROR_STOP=1 -d alverde -f "$REPO/supabase/seed.sql"
echo "== pgTAP"
pg_prove -d alverde "$REPO"/supabase/tests/*.sql
