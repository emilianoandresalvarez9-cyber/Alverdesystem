# Alverde — reglas de trabajo para agentes

Este archivo manda sobre cualquier otro documento del repo. Si `TAREAS.md`, un prompt o un
comentario dicen otra cosa, vale lo que dice acá.

## Antes de empezar

1. Leer `requisitos-sistema-dietetica.md` completo y el RF/RNF que vas a tocar.
2. Correr `npm ci && npm run verify` sobre `main` y anotar el resultado. Si `main` ya está roja,
   no empezás tu tarea: lo reportás.
3. Trabajar en una rama propia y abrir Pull Request hacia `main`. Nunca escribir en `main`.

## Definición de terminado

Una tarea está terminada solo si se cumplen **todas**:

- `npm run verify` pasa (guard, tipos, tests, build) y el CI del PR está verde, incluido el job
  `database` (`supabase test db`).
- Cada RF que el PR dice cubrir tiene al menos un test que **falla si el RF se rompe**. Un test que
  pasaría igual con el código borrado no cuenta.
- Si tocaste SQL: hay un test pgTAP en `supabase/tests/` que ejercita el cambio con los roles reales
  (empleado, otro empleado, administrador y, si aplica, `anon`).
- No quedan datos inventados, `console.log` de depuración ni `alert()` como única confirmación de
  una operación que debería persistir.
- La descripción del PR usa la plantilla y adjunta la salida real de los comandos.

## Prohibido (el CI lo bloquea o QA rechaza el PR)

- `expect(true).toBe(true)` o cualquier aserción que no depende del código. Si el test todavía no
  existe, usá `it.todo(...)`: queda visible como pendiente en vez de figurar como aprobado.
- `.only` en tests.
- Datos mock en `src/` fuera de archivos `*.test.ts`. La lista `qa/mocks-conocidos.txt` solo se achica.
- **Editar una migración que ya existe.** Toda corrección de esquema va en una migración nueva con
  timestamp posterior. El job `migrations` del CI lo verifica.
- Crear una vista o tabla en `public` sin revocar `anon`. Supabase concede todo objeto nuevo a `anon`
  por defecto; una vista con `security_invoker = false` queda legible sin login.
- Funciones `security definer` sin `set search_path = public`.
- Escrituras de ventas, stock o fiado directo desde el navegador a las tablas. Van por RPC
  (`process_offline_sale`, `apply_offline_operation` o una RPC nueva) para ser atómicas e idempotentes.
- Exponer costos, márgenes o multiplicadores a Empleado (RNF-04), ni siquiera ocultos en una caché.
- Declarar "completado", "100 %", "listo para producción" o "aprobado" en commits, `TAREAS.md` o
  PRs. El estado lo declara QA después de revisar evidencia.

## Contratos que no se rompen

- Operaciones offline: eventos con `localId` idempotente. No se sobrescriben ni se descartan si
  falla la sincronización.
- Medios de pago: los valores del enum `payment_method` de la base (`cash`, `transfer`, `qr`,
  `credit`). El frontend no inventa otros.
- Saldo de fiado: suma de `credit_movements`. Nunca un campo que se pisa (RF-46).
- Solo Administrador ajusta o perdona deuda (RF-48) y define el tope de fiado (RF-47).

## Commits y PRs

- Commits pequeños, en español, con el formato `tipo(ámbito): qué cambia (RF-xx)`.
- Un PR resuelve un problema. Si encontrás otro defecto, lo reportás en la descripción; no lo
  mezclás.
- Si no pudiste correr algo (por ejemplo, sin Docker), lo decís explícitamente en el PR. Para SQL
  sin Docker existe `npm run test:db:nodocker` (ver `qa/pg-harness/README.md`).
