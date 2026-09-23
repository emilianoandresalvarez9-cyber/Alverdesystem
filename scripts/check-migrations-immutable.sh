#!/usr/bin/env bash
# Falla si un PR modifica, renombra o borra una migración que ya existe en la rama base.
# Las correcciones de esquema van SIEMPRE en una migración nueva.
set -euo pipefail
BASE_REF="${1:-origin/main}"
changed=$(git diff --name-status "$BASE_REF"...HEAD -- supabase/migrations | awk '$1 !~ /^A/ {print}')
if [ -n "$changed" ]; then
  echo "✗ Se modificaron migraciones existentes (solo se permite agregar nuevas):"
  echo "$changed"
  exit 1
fi
echo "Migraciones OK: solo se agregaron archivos nuevos."
