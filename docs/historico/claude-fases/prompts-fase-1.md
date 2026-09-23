# Prompts listos para los agentes de Fase 1 — Alverdesystem

**Cómo usar este archivo:** cada sección de abajo es un prompt completo y autocontenido. Copiá el que corresponda y pegáselo a la IA que vaya a ocupar ese rol (Codex, Claude Code, Antigravity u otra — los roles no están atados a una herramienta). Podés darle el mismo prompt a distintas IAs en distintos momentos: cada uno explica el contexto desde cero.

**Requisitos previos (en este orden):**

1. El PR #1 (Fase 0) tiene que estar mergeado a `main` con el CI en verde — las instrucciones para eso están en el documento `instrucciones-agente-alverdesystem.md` que ya te entregué.
2. El **Agente D va primero**: los agentes A, B y C construyen con sus componentes. Para el Agente D ya tenés un adelanto: el zip `alverde-fase1-agente-d.zip` con el sistema de diseño implementado y verificado (adjuntáselo o pasale sus archivos junto con el prompt D).

---

## Prompt — Agente D · Sistema de diseño (RNF-06 a RNF-09) — VA PRIMERO

```
Sos el Agente D del proyecto Alverde, un sistema web de gestión para una
dietética. Repositorio: https://github.com/emilianoandresalvarez9-cyber/Alverdesystem

Antes de tocar nada, leé COMPLETO el archivo `requisitos-sistema-dietetica.md`
de la raíz del repo (es la fuente de verdad) y el archivo `AGENTS.md`.
Tu tarea es la fila "D — Sistema de diseño" de la tabla de Fase 1 de la
sección 12: definir colores, tipografía y componentes de base con estética de
glassmorfismo (RNF-06), transiciones entre páginas (RNF-07/RNF-08) y
modularidad (RNF-09), para que los agentes A, B y C construyan con tu kit en
vez de inventar cada uno su estilo.

IMPORTANTE: ya existe un kit implementado y verificado (typecheck estricto y
render probado) que te entregan junto con este prompt. Contiene:
- src/styles/tokens.css (tokens de diseño: colores, radios, espaciado,
  tipografía, movimiento, más el modo `sin-blur` para hardware modesto)
- src/styles/global.css (reemplaza la global.css de Fase 0 manteniendo todas
  sus clases, y suma botones, campos, select, badges, tags, tablas, toolbar,
  estado vacío, esqueleto y modal)
- src/shared/ui/ (componentes React tipados: Button, GlassCard, TextField,
  SelectField, Badge, Tag, EmptyState, Modal, con barrel index.ts)
- DISEÑO.md (guía de uso para los demás agentes, incluye el presupuesto de
  rendimiento) y demo/index.html (muestrario estático)

Tu trabajo:
1. Creá la rama `agente-d-diseno` desde `main`.
2. Integrá el kit: tokens.css nuevo, global.css reemplazado, carpeta
   src/shared/ui/ agregada, DISEÑO.md en la raíz del repo. La carpeta demo/
   agregala como demo/ en la raíz (no entra al build de Vite).
3. Verificá que las tres páginas existentes (login, catálogo, administración)
   se siguen viendo bien: las clases de Fase 0 se mantuvieron a propósito.
4. Corré `npm run typecheck`, `npm test` y `npm run build`.
5. Revisá el kit con criterio propio: si algo contradice los requisitos,
   corregilo y anotalo en el commit. Si agregás tokens o componentes,
   documentalos en DISEÑO.md.
6. Abrí un Pull Request hacia `main` describiendo qué RNF cubre y qué QA
   pasaste, con commits chicos y descriptivos.

Criterio de aceptación (sección 12): las transiciones (View Transitions API)
andan en la notebook real de la caja (Windows 10, Celeron/Atom, Edge), no solo
en una PC potente, y el desenfoque no genera lag notable. Si no podés probar
en esa notebook, dejalo escrito como pendiente en el PR y en TAREAS.md para
que un humano lo verifique.

Reglas del repo: nunca commitear directo a main; ninguna clave o secreto en el
código; los dispositivos con rol Empleado jamás reciben costos ni márgenes;
cada cambio con una prueba o verificación concreta. Al terminar (o si te vas a
quedar sin tokens), actualizá TAREAS.md: qué quedó hecho, en qué rama, y qué
falta.
```

---

## Prompt — Agente A · Catálogo y clasificación (RF-01 a RF-06)

```
Sos el Agente A del proyecto Alverde, un sistema web de gestión para una
dietética. Repositorio: https://github.com/emilianoandresalvarez9-cyber/Alverdesystem

Antes de tocar nada, leé COMPLETO `requisitos-sistema-dietetica.md` (fuente de
verdad; tu tarea es la fila "A — Catálogo y clasificación" de la tabla de
Fase 1 de la sección 12), `AGENTS.md`, `TAREAS.md` y `DISEÑO.md`.

Tu tarea: implementar RF-01 a RF-06 —
- RF-01: todo empleado busca y ve el catálogo completo desde el celular, sin
  instalar nada.
- RF-02: cada producto se clasifica en tres ejes independientes: Marca/Empresa
  (incluye "Del local"), Rubro (con subrubros opcionales) y Etiquetas
  (varias a la vez: vegano, sin TACC, apto diabético, etc.).
- RF-03: el administrador crea, renombra, une y archiva marcas, rubros y
  etiquetas, y las asigna de a uno o en bloque.
- RF-04: filtros por marca, rubro y etiqueta, combinables entre sí.
- RF-05: cualquier vista del catálogo se exporta a Excel.
- RF-06: todo lo que produce el local va bajo la marca "Del local".

Cómo trabajar:
1. Rama `agente-a-catalogo` desde `main`. Nunca commits directos a `main`.
2. Construí SOLO con el sistema de diseño del Agente D: componentes de
   `src/shared/ui` y clases de `src/styles/global.css`. No inventes estilos
   nuevos; si falta un token o componente, agregalo en el sistema de diseño y
   documentalo en DISEÑO.md.
3. El esquema de datos ya existe (migraciones de Fase 0, sección 13 del
   documento de requisitos): consumilo, no lo redefinas. Los empleados leen el
   catálogo por la vista restringida (`employee_catalog`) que NO incluye
   costos ni márgenes; no la puentees jamás (RNF-04).
4. Respetá el modo offline de Fase 0: el catálogo se cachea localmente
   (RF-34); tus pantallas deben funcionar con esa copia cuando no hay red.
5. Commits chicos vinculados a los RF que cubren, con una prueba o
   verificación concreta cada uno. Al final, PR hacia `main` describiendo qué
   RF cubre y qué QA pasó.

QA de aceptación (sección 12): un Empleado busca cualquier producto de prueba
desde el celular; combinar filtro de marca + etiqueta da el resultado
correcto; el administrador crea una etiqueta nueva y la asigna a varios
productos en una sola acción; exportar a Excel abre bien y coincide con lo que
se ve en pantalla.

Al terminar (o si te vas a quedar sin tokens), actualizá TAREAS.md: qué quedó
hecho, en qué rama, y qué falta.
```

---

## Prompt — Agente B · Roles, cuentas e historial (RF-58 a RF-60 + tabla de roles)

```
Sos el Agente B del proyecto Alverde, un sistema web de gestión para una
dietética. Repositorio: https://github.com/emilianoandresalvarez9-cyber/Alverdesystem

Antes de tocar nada, leé COMPLETO `requisitos-sistema-dietetica.md` (fuente de
verdad; tu tarea es la fila "B — Roles, cuentas e historial" de la tabla de
Fase 1 de la sección 12), `AGENTS.md`, `TAREAS.md` y `DISEÑO.md`.

Tu tarea:
- RF-59: el rol Administrador lo ocupan varias personas (las hijas de la
  dueña), cada una con su propia cuenta; nunca un login compartido.
- Tabla de permisos de la sección 5: dos roles (Administrador y Empleado) con
  exactamente esos permisos. Los costos y márgenes viven detrás de control de
  acceso A NIVEL DE DATOS (RLS), no solo ocultos en pantalla (RNF-04).
- RF-58: cada cambio sobre un producto guarda quién lo hizo, cuándo y qué
  valor tenía antes.
- RF-60: pantalla de Historial de modificaciones (solo Administrador), con
  búsqueda y filtros por producto, por persona y por fecha, mostrando valor
  anterior y nuevo.

Cómo trabajar:
1. Rama `agente-b-roles` desde `main`. Nunca commits directos a `main`.
2. La base de Fase 0 ya trae Supabase Auth, perfiles con rol, RLS y la tabla
   de historial (sección 13: HistorialCambios): partí de eso. Lo tuyo es
   completar el registro de cambios donde falte, la gestión de cuentas y la
   pantalla de historial.
3. Construí SOLO con el sistema de diseño del Agente D (src/shared/ui y
   global.css); no inventes estilos.
4. Probá la seguridad como atacante: un usuario con rol Empleado NO debe poder
   ver costos ni márgenes ni manipulando URLs, ni llamando directo a la API de
   Supabase con su token. Esa prueba es parte de tu entrega.
5. Commits chicos vinculados a los RF, cada uno con una prueba o verificación.
   Al final, PR hacia `main` describiendo qué RF cubre y qué QA pasó.

QA de aceptación (sección 12): cada administradora tiene su propio usuario;
un Empleado no puede ver costos ni márgenes ni manipulando la URL a mano; el
historial de modificaciones se filtra por persona, producto y fecha.

Al terminar (o si te vas a quedar sin tokens), actualizá TAREAS.md: qué quedó
hecho, en qué rama, y qué falta.
```

---

## Prompt — Agente C · Reposición y faltantes (RF-49 a RF-51)

```
Sos el Agente C del proyecto Alverde, un sistema web de gestión para una
dietética. Repositorio: https://github.com/emilianoandresalvarez9-cyber/Alverdesystem

Antes de tocar nada, leé COMPLETO `requisitos-sistema-dietetica.md` (fuente de
verdad; tu tarea es la fila "C — Reposición y faltantes" de la tabla de
Fase 1 de la sección 12), `AGENTS.md`, `TAREAS.md` y `DISEÑO.md`.

Tu tarea:
- RF-49: cualquier empleado marca un producto como "Falta / se está acabando"
  desde su celular.
- RF-50: esas marcas arman una lista de reposición agrupada por proveedor, a
  modo de pedido de compra.
- RF-51: el ingreso de mercadería nueva es rápido: escanear el código, cargar
  cantidad y vencimiento. (El lector de código de barras funciona como
  teclado: escanea y "tipea" el número; no hay conexión a bases externas.)

Cómo trabajar:
1. Rama `agente-c-faltantes` desde `main`. Nunca commits directos a `main`.
2. Construí SOLO con el sistema de diseño del Agente D (src/shared/ui y
   global.css); no inventes estilos.
3. El esquema de Fase 0 (sección 13) ya define productos, proveedores y
   movimientos de stock: consumilo, no lo redefinas. Si necesitás una tabla
   para las marcas de faltante, proponela como migración nueva siguiendo las
   convenciones de supabase/migrations/ y anotala en el PR.
4. Marcar un faltante tiene que funcionar sin conexión: usá la cola offline de
   Fase 0 (operaciones como eventos con localId idempotente; nunca las
   sobrescribas ni descartes).
5. Commits chicos vinculados a los RF, cada uno con una prueba o verificación.
   Al final, PR hacia `main` describiendo qué RF cubre y qué QA pasó.

QA de aceptación (sección 12): marcar "falta" desde el celular toma menos de
3 toques; la lista de reposición agrupa bien por proveedor.

Al terminar (o si te vas a quedar sin tokens), actualizá TAREAS.md: qué quedó
hecho, en qué rama, y qué falta.
```

---

## Orden de fusión y coordinación (para vos, Emiliano)

1. Primero se mergea el PR del **Agente D** (los demás usan sus componentes).
2. Después A, B y C en el orden en que terminen. Si dos tocan el mismo archivo,
   el que termina después resuelve el conflicto contra la versión más nueva de
   `main` (regla de la sección 14).
3. Revisá cada PR antes de mergear, mirando el diff. Antes de dar la Fase 1
   por cerrada, corré el QA de integración de la sección 12 (por ejemplo: un
   producto nuevo cargado desde Catálogo aparece bien en el botón de
   faltantes, y el Historial refleja cambios hechos desde Catálogo).
