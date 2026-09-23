# Instrucciones para el agente que hace los commits y los Pull Requests

Este paquete tiene 10 PRs preparados y verificados por QA sobre `main` = `0368b1f`. Tu trabajo es
aplicarlos **en orden**, abrir cada PR y no mergear ninguno con el CI en rojo. No reescribas el
código de los parches: si algo falla, lo corregís con un commit nuevo en la misma rama y lo
explicás en el PR.

## Contenido

| Archivo | Para qué |
|---|---|
| `patches/PR-01-….patch` … `PR-10-….patch` | Un parche por PR (formato `git format-patch`, con mensaje de commit). |
| `descripciones/PR-01.md` … `PR-10.md` | Descripción de cada PR, lista para `--body-file`. |
| `todos-los-prs.mbox` | Los 10 commits en un solo archivo, por si preferís aplicar todo de una vez. |

## Verificación que ya hizo QA

- Los 10 parches se aplican limpios con `git am` sobre un clon nuevo de GitHub (`main` = `0368b1f`)
  y el árbol resultante es idéntico al verificado.
- Estado final: `npm run verify` en verde (67 tests + 1 pendiente, build correcto) y 94 tests pgTAP
  en verde con `npm run test:db:nodocker`.
- **No verificado**: el job `database` en GitHub Actions (`supabase test db`) y la interfaz en un
  navegador real. Ver "Riesgos conocidos".

## Orden y dependencias

`PR-01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10`. Cada uno depende del anterior. No los
reordenes ni los combines.

## Modo recomendado: de a uno

Repetí esto para cada `NN` de 01 a 10, empezando el siguiente recién cuando el anterior esté
mergeado:

```bash
git switch main && git pull --ff-only
git switch -c pr-NN-<nombre>                       # el nombre está en el archivo del parche
git am --3way /ruta/alverde-prs/patches/PR-NN-<nombre>.patch
npm ci && npm run verify                           # tiene que terminar en verde
npm run test:db:nodocker                           # si tocaste SQL y no tenés Docker (ver qa/pg-harness/README.md)
git push -u origin pr-NN-<nombre>
gh pr create --base main --head pr-NN-<nombre> \
  --title "$(head -1 /ruta/alverde-prs/descripciones/PR-NN.md | sed 's/^# //')" \
  --body-file /ruta/alverde-prs/descripciones/PR-NN.md
```

Mergeá recién con los checks `frontend`, `database` y `migrations` en verde. Con este modo sirve
cualquier método de merge.

## Modo alternativo: los 10 PRs abiertos a la vez (apilados)

```bash
git switch main && git pull --ff-only
prev=main
for p in /ruta/alverde-prs/patches/PR-*.patch; do
  b=$(basename "$p" .patch | tr 'A-Z' 'a-z')        # pr-01-ci-puerta-de-calidad, …
  n=$(echo "$b" | cut -d- -f2)
  git switch -c "$b" "$prev" && git am --3way "$p" && git push -u origin "$b"
  gh pr create --base "$prev" --head "$b" \
    --title "$(head -1 /ruta/alverde-prs/descripciones/PR-$n.md | sed 's/^# //')" \
    --body-file /ruta/alverde-prs/descripciones/PR-$n.md
  prev="$b"
done
```

En este modo mergeá **en orden** y **solo con "Create a merge commit"**. "Squash" o "Rebase" duplican
los commits en los PRs siguientes. Al mergear un PR, borrá su rama: GitHub cambia la base del
siguiente a `main` automáticamente.

## Prohibido

- Editar una migración que ya existe, ni siquiera para resolver un conflicto. El job `migrations`
  lo bloquea. Toda corrección de esquema va en una migración nueva.
- Desactivar o saltear un job del CI, o marcar tests como `.skip` para que pase.
- Mergear con el CI en rojo, o forzar pushes a `main`.
- Declarar en commits o PRs que algo está "completado" o "listo para producción". Seguí `AGENTS.md`.

## Si algo falla

- `git am` no aplica (alguien cambió `main`): `git am --abort`, no resuelvas a mano tocando
  migraciones y reportá qué cambió en `main`.
- Falla un check del CI: corregí con un commit nuevo en la misma rama, con mensaje que explique la
  causa, y pegá en el PR la salida del error y la de la corrección.

## Riesgos conocidos

1. **Primera corrida de `supabase test db` en GitHub (tarea T-04).** QA lo validó con un arnés que
   emula Supabase, no con la CLI. Si el job falla con `function plan(integer) does not exist`, la
   CLI no habilitó pgTAP: agregá en PR-01 un paso previo que lo cree
   (`create extension if not exists pgtap with schema extensions`) y reportalo.
2. La interfaz (caja, clientes, balanza) no se probó en un navegador. Cada descripción trae los
   pasos de prueba manual.
3. Los commits tienen como autor "Alverde QA Lead"; `git am` lo conserva y el committer sos vos.
   Si el dueño prefiere otra autoría, que lo decida él.

## Lo que hace el dueño del repositorio (no el agente)

- Proteger `main` (Settings → Branches/Rules): exigir PR y los 3 checks, bloquear force push (T-05).
- Después de PR-08: crear al menos una sucursal y una caja en Administración.
- Después de PR-10: marcar en Administración → Balanza lo que se vende suelto.
- Probar en la notebook real de la caja con el lector y cortando internet (T-03).
