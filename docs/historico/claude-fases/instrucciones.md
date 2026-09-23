en esta carpete se encontraran los avances que hizo claude respecto a la fase0 y fase 1 

Instrucciones para el agente de IA — Alverdesystem

Repositorio: https://github.com/emilianoandresalvarez9-cyber/Alverdesystem Fecha de estas instrucciones: 22/09/2026 (verificado contra el repo ese día)

Tu misión, en este orden:

Arreglar el CI del Pull Request #1 (hoy está en rojo).
Mergear el PR #1 a main.
Crear el archivo TAREAS.md en la raíz de main (contenido exacto más abajo), para que cualquier agente que entre al proyecto sepa qué está hecho, qué sigue y qué le toca.
0. Antes de tocar nada
Leé completo requisitos-sistema-dietetica.md (está en la raíz del repo). Es la fuente de verdad del proyecto. En particular: la sección 12 define la asignación de tareas por agente y sus criterios de aceptación, la sección 13 el modelo de datos, y la sección 14 el flujo de Git.
Reglas vigentes de AGENTS.md (hoy solo está en la rama codex/fase-0-cimientos; tras el merge quedará en main):
Nadie escribe directo en main: una rama por tarea y Pull Request hacia main.
Nunca exponer costos, márgenes, multiplicadores, claves ni secretos en rutas, vistas o cachés accesibles al rol Empleado.
Las operaciones offline son eventos con localId idempotente: no se sobrescriben ni se descartan si falla la sincronización.
Cada cambio incluye una prueba o verificación concreta, y commits chicos y descriptivos vinculados a los RF/RNF que cubren.
Si estás por quedarte sin tokens o capacidad: dejá anotado en TAREAS.md y en el último commit hasta dónde llegaste, para que otra IA continúe (es una regla explícita del documento de requisitos).
1. Estado actual del repo (verificado el 22/09/2026)
main (commit 0495d60): solo tiene LICENSE y requisitos-sistema-dietetica.md. No tiene código. Por eso, un agente que solo mira main no ve ni el código ni las instrucciones de trabajo — ese es el problema que estas instrucciones resuelven.
Rama codex/fase-0-cimientos (commit cdf9ca3): implementación de la Fase 0 —
React + Vite en modo multipágina con TypeScript: entradas index.html (login), catalog.html, admin.html, con src/entries/ y src/pages/.
Supabase: migraciones supabase/migrations/20260922000001_fase0_schema.sql y 20260922060000_phase_0_foundation.sql (entidades de la sección 13, RLS, vista employee_catalog, RPC apply_offline_operation, datos iniciales), supabase/seed.sql, tests en supabase/tests/ (001_foundation_smoke.sql, smoke_test.sql).
Offline: Service Worker (public/sw.js, src/shared/offline/registerServiceWorker.ts), cola idempotente (queue.ts, sync.ts), segundo respaldo local (backup.ts).
Auth (src/shared/auth/), cliente Supabase (src/shared/supabase/client.ts), CI en .github/workflows/ci.yml.
PR #1 "Fase 0: cimientos de Alverde": abierto, 8 commits, 40 archivos, +2.244 líneas, de codex/fase-0-cimientos hacia main. main no avanzó desde que se abrió el PR, así que al día de hoy no hay conflictos.
El CI del PR está en rojo. Workflow "Verificación de Fase 0" (.github/workflows/ci.yml, se dispara on: pull_request), con dos jobs:
frontend: falla a los ~25 segundos, exit code 1 (falla temprano: instalación de dependencias, typecheck o tests).
database: falla a los ~2 minutos, exit code 1 (falla dentro del ciclo de Supabase: start / db reset / tests SQL).
Fallaron los 5 runs del workflow. El último: https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/actions/runs/35715885374
Las anotaciones públicas solo dicen "Process completed with exit code 1"; hace falta leer el log completo (requiere sesión de GitHub) o reproducir localmente.
Nota menor: hay warnings de deprecación (las actions actions/checkout@v4, actions/setup-node@v4 y supabase/setup-cli@v1 apuntan a Node 20 y GitHub las fuerza a Node 24). No son la causa del fallo, pero ya que tocás ci.yml conviene actualizar las versiones de esas actions.
2. Tarea A — Diagnosticar y arreglar el CI (en la rama codex/fase-0-cimientos)
Leé el log completo de los dos jobs del último run (link arriba). Si no podés acceder a los logs, reproducí localmente sobre la rama:
Frontend: instalar dependencias y correr lo mismo que corre ci.yml. Pista concreta: el commit 328084b se llama "ci: habilita verificación inicial sin archivo de bloqueo", lo que sugiere que el repo no tiene package-lock.json. Verificá qué comando de instalación usa ci.yml: npm ci sin lockfile falla siempre; si es eso, la solución correcta es generar y commitear el package-lock.json (mejor que cambiar a npm install, porque fija versiones reproducibles). Después: npm run typecheck, npm test, npm run build.
Database: con Docker y la CLI de Supabase: npx supabase start, npx supabase db reset (aplica las dos migraciones y el seed) y correr los tests de supabase/tests/ exactamente como los invoca ci.yml. Ojo con el orden y la compatibilidad entre las dos migraciones (20260922000001 y 20260922060000): fueron escritas en momentos distintos y pueden chocar entre sí (objetos duplicados, referencias a tablas que la otra ya creó o renombró).
Arreglá la causa raíz en commits chicos y descriptivos (fix(ci): ...), en la misma rama del PR. No bajes la exigencia del CI para que "pase": no borres tests, no agregues continue-on-error, no comentes pasos. Si un test está objetivamente mal escrito, corregí el test y explicá por qué en el mensaje del commit.
Empujá los cambios y verificá que el workflow "Verificación de Fase 0" quede en verde en el PR #1.
3. Tarea B — Mergear el PR #1
Con el CI en verde, mergeá el PR #1 a main con merge normal (no squash): el historial de commits chicos es parte de las reglas del proyecto (sección 14).
Si main avanzó mientras trabajabas, el conflicto se resuelve en la rama del PR contra la versión más nueva de main, nunca al revés (regla de la sección 14).
Después del merge, verificá que en main estén: README.md, AGENTS.md, src/, supabase/, .github/workflows/ci.yml y los tres HTML de entrada.
4. Tarea C — Crear TAREAS.md en la raíz de main

Creá una rama tareas-estado, agregá el archivo TAREAS.md con el contenido de abajo (ajustá las fechas al día real), abrí un PR hacia main y mergealo (es documentación de coordinación, no necesita revisión larga).

Contenido exacto del archivo:

markdown
# TAREAS — estado y asignación del proyecto Alverde

**Última actualización:** [FECHA] — actualizá este campo cada vez que edites este archivo.

Este archivo existe para que cualquier agente de IA que entre al proyecto sepa
en menos de un minuto qué está hecho, qué se está haciendo y qué le toca.
No reemplaza a `requisitos-sistema-dietetica.md` (la fuente de verdad):
la asignación completa y los criterios de aceptación están en su sección 12.

## Cómo trabajar acá (resumen)

1. Leé `requisitos-sistema-dietetica.md` COMPLETO antes de implementar nada.
2. Una rama por tarea (ver nombres sugeridos abajo), Pull Request hacia `main`.
   Nunca commits directos a `main`.
3. Antes de empezar una tarea: anotá acá tu identificación y la rama, y marcá
   la tarea como "En curso". Cuando tu PR se mergea: marcala "Hecha".
4. Si te vas a quedar sin tokens o capacidad: anotá en "Registro de avance"
   hasta dónde llegaste y en qué rama quedó el trabajo.
5. Dos agentes no editan las mismas carpetas al mismo tiempo.
6. QA real: el modo offline y el rendimiento visual se prueban en la notebook
   de la caja, con Edge, simulando corte de internet — no solo en una PC rápida.

## Estado de fases

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Cimientos: repo, esquema Supabase, offline, login | ✅ Terminada (PR #1 mergeado el [FECHA]) |
| 1 | Catálogo consultable desde celular | ⏳ En curso — arranca el Agente D |
| 2 | Stock por lote, vencimientos, fraccionamiento, códigos de barra | ❌ No empezar hasta cerrar Fase 1 |
| 3 | Caja: ventas, offline, backups, clientes y fiado | ❌ No empezar hasta cerrar Fase 2 |
| 4 | Escalabilidad, reportes, preparado para el futuro | ❌ No empezar hasta cerrar Fase 3 |

## Tareas de Fase 1

El Agente D va PRIMERO: entrega los componentes base (glassmorfismo, tipografía,
colores, transiciones) para que A, B y C construyan con ese estilo desde el
inicio. A, B y C pueden trabajar en paralelo después de esa primera entrega de D.

| Tarea | Agente | Cubre | Rama sugerida | Estado |
|---|---|---|---|---|
| Sistema de diseño | D | RNF-06 a RNF-09 | `agente-d-diseno` | Libre |
| Catálogo y clasificación | A | RF-01 a RF-06 | `agente-a-catalogo` | Libre |
| Roles, cuentas e historial | B | RF-59, RF-58, RF-60 y tabla de roles (sección 5) | `agente-b-roles` | Libre |
| Reposición y faltantes | C | RF-49 a RF-51 | `agente-c-faltantes` | Libre |

Criterios de aceptación de cada tarea: tabla "Fase 1" de la sección 12 de
`requisitos-sistema-dietetica.md`. Orden de fusión: primero D, después el resto
según terminen.

## Registro de avance

- [FECHA] — Fase 0 terminada: PR #1 mergeado con CI en verde. Se creó este archivo.
5. Al terminar
Dejá un comentario en el PR #1 (o en el commit final) explicando qué era lo que fallaba en el CI y cómo lo arreglaste.
Verificá que TAREAS.md esté en main y que su "Estado de fases" refleje la realidad.
Si algo de estas instrucciones contradice a requisitos-sistema-dietetica.md, manda el documento de requisitos, y anotá la discrepancia en TAREAS.md para que un humano la revise.
Todo cambio de decisión o de regla se actualiza primero en requisitos-sistema-dietetica.md (regla propia del documento).
Checklist final (todo tiene que dar sí)
 Workflow "Verificación de Fase 0" en verde sobre la rama del PR #1.
 PR #1 mergeado a main (merge normal, no squash).
 main contiene el código de Fase 0 completo (src/, supabase/, CI, HTMLs).
 TAREAS.md en la raíz de main, con fechas reales y Fase 1 lista para arrancar.
 Comentario en el PR #1 explicando el diagnóstico del CI.
 Ninguna clave ni secreto commiteado; .env.local sigue fuera del repo
