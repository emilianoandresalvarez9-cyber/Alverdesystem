# Alverde System

Sistema web de gestión para dietética. Esta rama implementa los cimientos de la Fase 0 definidos en \`requisitos-sistema-dietetica.md\`.

## Qué ya está resuelto

- React + Vite en modo multi-página: inicio de sesión, catálogo y administración son entradas independientes.
- Supabase/Postgres con todas las entidades de la sección 13: productos, presentaciones, lotes, ventas, movimientos, clientes, fiado, sucursales, puestos, auditoría y cola de eventos offline.
- Autenticación por Supabase Auth y control de acceso a nivel de datos con RLS.
- Catálogo y lotes para empleados mediante vistas que no incluyen costos, márgenes ni multiplicadores.
- Service Worker para la interfaz, copia del catálogo en IndexedDB, cola local de operaciones con identificador de dispositivo y reintentos idempotentes.
- Segunda copia de las operaciones pendientes: la administradora elige una carpeta una vez desde Administración; después de ese permiso, cada modificación pendiente actualiza el archivo \`alverde-operaciones-pendientes.json\`.
- Pruebas de la cola local y una comprobación SQL de las entidades y políticas esenciales.

## Puesta en marcha local

Requisitos: Node.js 22+, Docker Desktop y la CLI de Supabase.

1. Ejecutar \`npm install\`.
2. Ejecutar \`npx supabase start\`.
3. Ejecutar \`npx supabase db reset\`. Aplica la migración y crea la marca inicial **Del local**.
4. Ejecutar \`npx supabase status\` y copiar la URL de API y la clave anon local a \`.env.local\`, tomando \`.env.example\` como plantilla.
5. Ejecutar \`npm run dev\`.
6. Para crear el primer acceso, crear el usuario en Supabase Studio / Auth con metadata \`display_name\`. Después, en el SQL Editor local, convertirlo en administradora:

\`\`\`sql
update public.profiles
set role = 'administrator'
where id = 'UUID_DEL_USUARIO';
\`\`\`

La migración crea el perfil automáticamente al crear un usuario de Auth. No hay credenciales de Supabase en el repositorio.

## Puesta en marcha cloud

1. Crear el proyecto de Supabase de la dietética.
2. Instalar la CLI, iniciar sesión y enlazar el proyecto: \`supabase link --project-ref REF\`.
3. Aplicar el modelo: \`supabase db push\`.
4. Crear la primera administradora y asignarle el rol tal como en el paso local.
5. En el hosting del frontend, declarar solo \`VITE_SUPABASE_URL\` y \`VITE_SUPABASE_ANON_KEY\`. La clave de servicio no se usa en el navegador ni debe subirse a GitHub.

## Verificación

\`\`\`bash
npm run typecheck
npm test
npm run build
supabase db reset
\`\`\`

Las pruebas automáticas comprueban que las operaciones se guardan localmente antes de salir, que no se duplican al marcarlas sincronizadas y que el catálogo queda disponible en el dispositivo. La validación SQL comprueba las tablas, RLS de lotes y la vista restringida para empleados.

## Límite deliberado de seguridad

Los navegadores no pueden escribir libremente en el disco sin una autorización explícita del usuario. Por eso la carpeta del segundo respaldo se elige una vez desde Administración. Si el navegador pierde ese permiso, la cola sigue intacta en IndexedDB y la pantalla permite volver a concederlo; nunca se descartan ventas por ello.
