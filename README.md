# Alverde System

Sistema web de gestión para dietética, según `requisitos-sistema-dietetica.md`.

**Estado:** en desarrollo, no apto para producción. Ver `docs/ESTADO_QA.md` y `TAREAS.md`.
Reglas para agentes: `AGENTS.md`.

Páginas: `/` (ingreso), `/catalog.html`, `/pos.html` (caja), `/customers.html` (clientes y fiado),
`/admin.html` (solo administradora).

## Qué ya está resuelto

- React + Vite en modo multi-página: inicio de sesión, catálogo y administración son entradas independientes.
- Supabase/Postgres con entidades para productos, presentaciones, lotes, ventas, movimientos, clientes, fiado, sucursales, puestos, auditoría y cola de eventos offline.
- Autenticación por Supabase Auth y control de acceso a nivel de datos con RLS.
- Catálogo y lotes para empleados mediante vistas que no incluyen costos, márgenes ni multiplicadores.
- Service Worker para la interfaz, copia del catálogo en IndexedDB, cola local de operaciones con identificador de dispositivo y reintentos idempotentes.
- Segunda copia de las operaciones pendientes: la administradora elige una carpeta una vez desde Administración; después de ese permiso, cada modificación pendiente actualiza el archivo `alverde-operaciones-pendientes.json`.

## Uso del sitio publicado

Si el sitio ya está desplegado, para usarlo en la caja o desde el celular basta con abrir su dirección web en Edge o Chrome. No hace falta clonar el repositorio, instalar Node.js, Docker ni la CLI de Supabase. En un navegador compatible también se puede instalar como aplicación desde el menú del navegador.

## Desarrollo local de la web (sin Docker)

Docker y la CLI de Supabase **no hacen falta para abrir la interfaz**. El comando local conecta Vite con el proyecto Supabase que configures:

1. Clona el repositorio una sola vez en la computadora que usarás para desarrollar.
2. Instala Node.js 22 o superior.
3. En Windows, haz doble clic en `Iniciar-Alverde.cmd`; en cualquier terminal ejecuta `npm run local`.
4. La primera vez, ingresa la URL del proyecto y su clave pública anon/publishable de Supabase. El iniciador crea `.env.local`, que Git ignora, instala las dependencias con `npm ci` una vez y abre `http://localhost:5173`.
5. Las veces siguientes, ejecuta el mismo comando. Conserva la configuración y las dependencias; solo reinstala si cambia `package-lock.json`.

Para obtener los valores, abre Supabase → proyecto → **Project Settings → API**. Usa solo la clave pública anon/publishable; nunca una clave `service_role` o secret key. También puedes crear `.env.local` manualmente copiando `.env.example`.

**Importante:** si configuras Alverdesys, las acciones hechas desde la web local se guardan en ese proyecto remoto. Usa datos de prueba para ensayar y evita probar operaciones destructivas sobre datos reales. Para una base aislada, usa el modo local con Supabase CLI descrito más abajo.

Para probar la interfaz desde otro dispositivo conectado a la misma red privada, ejecuta `npm run local -- --network`; el firewall de Windows puede pedir permiso. Esta opción sigue usando el mismo proyecto Supabase configurado. El modo offline requiere abrir la app desde `localhost` o desde un sitio HTTPS.

## Desarrollo y pruebas con una base Supabase aislada (opcional)

Este modo sí requiere Docker Desktop y la CLI de Supabase. Úsalo cuando necesites probar migraciones, RLS, pgTAP o E2E contra una base local:

```bash
npm ci
npx supabase start
npx supabase db reset
npx supabase status
```

Copia la URL y la clave anon local que informa `supabase status` a `.env.local`. Para crear el primer acceso, crea un usuario en Supabase Studio / Auth con metadata `display_name`; luego, en el SQL Editor local, asígnale rol de administradora:

```sql
update public.profiles
set role = 'administrator'
where id = 'UUID_DEL_USUARIO';
```

La migración crea el perfil automáticamente al crear un usuario de Auth. No hay credenciales de Supabase en el repositorio.

## Puesta en marcha cloud

1. Crear el proyecto de Supabase de la dietética.
2. Instalar la CLI, iniciar sesión y enlazar el proyecto: `supabase link --project-ref REF`.
3. Aplicar el modelo: `supabase db push`.
4. Crear la primera administradora y asignarle el rol tal como en el paso local.
5. En el hosting del frontend, declarar solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. La clave de servicio no se usa en el navegador ni debe subirse a GitHub.

## Verificación

```bash
npm run verify            # guard de calidad, tipos, tests y build
supabase test db          # migraciones + tests pgTAP (con Docker)
npm run test:db:nodocker  # harness alternativo (ver qa/pg-harness/README.md)
```

Antes de usar la caja, la administradora crea al menos una sucursal y una caja en
Administración → Sucursales y cajas.

Las pruebas automáticas comprueban que las operaciones se guardan localmente antes de salir, que no se duplican al marcarlas sincronizadas y que el catálogo queda disponible en el dispositivo. La validación SQL comprueba las tablas, RLS de lotes y la vista restringida para empleados.

## Límite deliberado de seguridad

Los navegadores no pueden escribir libremente en el disco sin una autorización explícita del usuario. Por eso la carpeta del segundo respaldo se elige una vez desde Administración. Si el navegador pierde ese permiso, la cola sigue intacta en IndexedDB y la pantalla permite volver a concederlo; nunca se descartan ventas por ello.
