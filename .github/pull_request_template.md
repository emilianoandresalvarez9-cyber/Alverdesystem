## Qué resuelve

<!-- Problema concreto, con el RF/RNF o el defecto QA que cierra (ej: CRÍTICO-03, P5). -->

## Cómo se verificó

<!-- Pegar la salida real, no un resumen. -->

- [ ] `npm run verify`
- [ ] `supabase test db` o `npm run test:db:nodocker` (si toca SQL)
- [ ] Prueba manual descrita paso a paso (si toca UI)

## Tests que fallarían si esto se rompe

<!-- Archivo y nombre del test por cada RF que dice cubrir. -->

## Checklist QA

- [ ] No edita migraciones existentes
- [ ] Objetos nuevos en `public` revocan `anon`
- [ ] Sin `expect(true)`, `.only` ni mocks nuevos en `src/`
- [ ] Sin costos ni márgenes hacia Empleado (RNF-04)
- [ ] No declara "completado" ni "listo para producción"

## Lo que queda fuera

<!-- Defectos vistos y no resueltos en este PR. -->
