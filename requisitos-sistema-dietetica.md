# Documento de Requisitos — Sistema de Gestión para Dietética
Antes de que se queden sin tokens o capacidad de procesamiento indicar hasta que parte se quedaron para que otra IA continue y cualquier tipo de cambio deberan notificarlo en los commit en caso de que entre dentro de sus posibilidades
**Estado:** Planificación cerrada, lista para pasar a desarrollo (Fase 1)
**Última actualización:** 21 de septiembre de 2026

> **Cómo usar este documento:** es la fuente de verdad del proyecto. Antes de pedirle a un agente de código (Claude Code, Codex, Antigravity, u otro) que construya algo, dale este archivo completo en vez de reexplicar el contexto. Cuando se tome una decisión nueva o cambie una regla, se actualiza acá primero.

---

## 1. Objetivo general

Reemplazar el inventario en papel del local por un sistema digital accesible desde celular, tablet y una caja con lector de código de barras, que permita buscar y consultar productos, controlar el stock por lote y vencimiento, y escalar a más cajas y sucursales sin rediseñar la base cuando el negocio crezca.

## 2. Objetivos específicos, KPI y meta esperada

Las metas marcadas como "sugerida" son un punto de partida para discutir con la dueña, no números definitivos.

| # | Objetivo específico | KPI | Meta esperada |
|---|---|---|---|
| 1 | Que cualquier empleado consulte el catálogo desde su celular en vez de preguntar o buscar en el cuaderno | % de consultas de producto resueltas por el sistema | 100% a un mes de lanzada la Fase 1 |
| 2 | Mantener el stock del sistema alineado con el stock real, por lote y vencimiento | Diferencia entre conteo físico y stock registrado | Menor al 5% (sugerida) |
| 3 | No perder ninguna venta ni modificación por falta de luz o de internet | Operaciones perdidas por caída de conexión | Cero |
| 4 | Reducir el producto que se vence en góndola sin venderse | Unidades/kg dados de baja por vencimiento | Baja medible trimestre a trimestre, con línea base tras el primer conteo |
| 5 | Actualizar precios frente a la inflación sin rehacer todo a mano | Tiempo para actualizar precios de todo el local | Menos de 30 minutos (sugerida) |
| 6 | Escalar a más cajas y sucursales sin rediseñar el sistema | Cambios estructurales necesarios para sumar una caja o sucursal | Cero; solo alta de un registro nuevo |
| 7 | Que los costos y márgenes sean visibles solo para quien la dueña autorice | Costos visibles desde un dispositivo de empleado | Cero |

## 3. Alcance

**Incluido en este proyecto:**
Catálogo, stock por lote, fraccionamiento y granel, códigos de barra propios, roles y permisos, caja con modo offline, backups, clientes y fiado, gestión de faltantes, escalabilidad a más cajas/sucursales.

**Con el campo preparado pero sin implementar todavía:**
Facturación electrónica (el local está en negro, pero puede blanquearse) y una interfaz genérica para conectar en el futuro una balanza u otro dispositivo, sin saber hoy qué marca o modelo van a comprar. La impresión de etiquetas no requiere comprar nada: el sistema genera el código y se manda a imprimir en una imprenta o local de stickers.

## 4. Hardware disponible

| Dispositivo | Detalle | Rol en el sistema |
|---|---|---|
| Notebook (plan gubernamental "Sarmiento") | Windows 10, Celeron/Atom, 8 GB RAM, SSD/eMMC 128 GB, WiFi + Bluetooth | Único puesto de caja hoy; conectada al lector. Por sus specs, el sistema debe correr en el navegador (Edge), no como programa instalado pesado |
| Otras notebooks/PC | Pueden tener Windows 11 u otro | Uso administrativo; no son requisito para que el sistema funcione |
| Celulares/tablets de empleados | Variados, usuarios jóvenes cómodos con tecnología | Consulta de catálogo, registro de faltantes, fraccionamiento |
| Lector de código de barras Nictom LCB3100 | Lector 1D (láser), decodifica EAN/UPC/Code 39. Funciona como teclado: escanea y "tipea" el número, no consulta nada por sí mismo | Búsqueda de productos y venta en el puesto de caja |
| Balanza Systel Cuora Max | No se identificaron puertos de conexión (USB/Ethernet/WiFi) en el frente; puede no tener ninguno en esta unidad | Por ahora, solo pesa: el empleado lee el peso y lo ingresa a mano en el sistema. El sistema deja una interfaz genérica de "conector de báscula" sin implementar, para no atarse a esta balanza puntual: el día que compren una nueva (u otro modelo), se implementa esa interfaz sin rediseñar nada más |

## 5. Roles y permisos

| Permiso | Administrador | Empleado |
|---|---|---|
| Ver catálogo, precios y proveedores | ✔ | ✔ |
| Ver costos y márgenes | ✔ | ✘ |
| Vender y cobrar | ✔ | ✔ |
| Registrar ingresos, fraccionar y ajustar stock (agregar o quitar, con motivo) | ✔ | ✔ |
| Registrar fiados y pagos | ✔ | ✔ |
| Crear/editar productos, precios, categorías | ✔ | ✘ |
| Anular ventas, perdonar o ajustar deudas | ✔ | ✘ |
| Usuarios, backups y reportes | ✔ | ✘ |

Son dos roles nada más. Los costos y márgenes viven en una tabla separada con acceso restringido a nivel de datos, no solo oculta en pantalla. La copia local del puesto de caja (para el modo offline) no debe incluir esta tabla.

## 6. Requerimientos funcionales

### Catálogo y clasificación
- **RF-01.** Todo empleado con acceso puede buscar y ver el catálogo completo desde celular o tablet, sin instalar nada (funciona desde el navegador).
- **RF-02.** Cada producto se clasifica en tres ejes independientes, no en un único árbol: **Marca/Empresa** (incluye "Del local" para lo que el negocio fracciona, embolsa o prepara), **Rubro** (granos, chocolates, panes, suplementos, etc., con subrubros opcionales) y **Etiquetas** (vegano, sin TACC / con TACC / no declarado, apto diabético, sin azúcar, con octógonos, etc.). Un producto puede tener varias etiquetas a la vez.
- **RF-03.** El administrador puede crear, renombrar, unir y archivar marcas, rubros y etiquetas libremente, y asignarlas a productos de a uno o en bloque, sin límite de cantidad.
- **RF-04.** El catálogo se puede ver filtrado por marca, por rubro o por etiqueta, y estos filtros se pueden combinar (ej. "chocolates" + "vegano").
- **RF-05.** Cualquier vista del catálogo se puede exportar a Excel.
- **RF-06.** Todo lo que vende o produce el propio local (granel y fraccionados) se clasifica bajo la marca "Del local", independientemente de a qué proveedor se le compró la materia prima.

### Stock, lotes y vencimientos
- **RF-07.** El stock se controla por lote, no solo por producto. Cada lote guarda: cantidad, fecha de ingreso, fecha de vencimiento del fabricante, proveedor y costo de compra.
- **RF-08.** El sistema calcula un vencimiento efectivo por lote, tomando el más próximo entre el vencimiento del fabricante y (si aplica) el vencimiento por apertura.
- **RF-09.** Al vender o fraccionar, el sistema descuenta primero del lote que vence más próximo, sin que el empleado tenga que elegirlo.
- **RF-10.** El administrador puede ver un listado de lotes y bolsas abiertas ordenado por antigüedad o cercanía de vencimiento.

### Fraccionamiento y granel
- **RF-11.** Producto a granel (ej. bolsa de 25 kg de lentejas): el lote es la bolsa abierta y cada venta descuenta gramos de ese lote.
- **RF-12.** Regla para granel: una sola bolsa abierta por producto a la vez; no se abre la siguiente hasta terminar la anterior.
- **RF-13.** Producto fraccionado en bolsitas (ej. 1 kg de palitos salados → bolsitas de 150 g): las bolsitas ya armadas son un producto propio con stock en unidades, separado del granel de origen.
- **RF-14.** Al fraccionar, el sistema pide elegir el lote de origen y la cantidad de bolsitas hechas; descuenta los gramos usados del lote y suma las unidades nuevas al stock.
- **RF-15.** Al terminar de fraccionar, el sistema pregunta obligatoriamente si la bolsa de origen queda abierta o se terminó.
- **RF-16.** Si se marca como terminada, el sistema cierra el lote y registra como merma la diferencia entre lo que debería quedar y lo que realmente quedaba.
- **RF-17.** Cada producto puede tener una vida útil configurable una vez abierto o fraccionado; la carga la dueña, es opcional, y se puede asignar producto por producto.
- **RF-17b.** La dueña puede seleccionar varios productos a la vez y cargarles o modificarles la vida útil (o su fecha) en una sola acción, sin tener que entrar producto por producto.

### Códigos de barra
- **RF-18.** El lector funciona como teclado: escanea un número y el sistema lo busca en su base. No hay conexión directa a ninguna base externa.
- **RF-19.** Productos de terceros usan el código de barras del fabricante (EAN/UPC).
- **RF-20.** Productos a granel y fraccionados por el local usan códigos EAN-13 generados internamente (rango reservado para uso interno, prefijo 20 a 29).
- **RF-21.** El código identifica al producto y su presentación (ej. "Garrapiñada 150 g"), no a cada bolsita individual.
- **RF-22.** Para el granel, el código se escanea desde una planilla impresa en el mostrador y el peso se ingresa a mano.
- **RF-23.** El precio nunca se codifica en la etiqueta ni en el código de barras; siempre se consulta al sistema, para no tener que reetiquetar cuando cambian los precios.

### Precios, costos y proveedores
- **RF-24.** Cada producto puede tener más de un proveedor, cada uno con su propio código, costo y fecha de última compra; uno se marca como proveedor principal.
- **RF-25.** El precio de venta sugerido sale de: último costo × multiplicador (por defecto 2, equivalente a 100% de recargo sobre el costo o 50% de margen sobre el precio de venta). El multiplicador se puede pisar por rubro o por producto.
- **RF-26.** El sistema calcula y muestra el margen en pesos y en porcentaje de cada producto, visible solo para el rol Administrador.
- **RF-27.** El sistema guarda un historial de precios por producto (para seguir la inflación).
- **RF-28.** El administrador puede actualizar precios de forma masiva, por porcentaje, por proveedor o por rubro, y revisar los cambios antes de confirmarlos.
- **RF-29.** El precio sugerido se redondea siempre a un múltiplo de 100.
- **RF-30.** Después de una actualización masiva, el sistema puede listar solo los productos cuyo precio cambió, para facilitar el reetiquetado físico.

### Caja y ventas
- **RF-31.** El puesto de caja registra ventas con sus productos, cantidades, precios y medio de pago (efectivo, transferencia o QR).
- **RF-32.** El cierre de caja muestra el total separado por medio de pago.
- **RF-33.** Cuando la balanza no está conectada al sistema, el empleado ingresa el peso leído a mano y el sistema calcula el importe con el precio por kilo del producto.
- **RF-33b.** El sistema define una interfaz genérica de "conector de báscula", sin implementar todavía, para poder sumar en el futuro la balanza (u otro dispositivo) que se compre, sin necesidad de saber hoy la marca o el modelo.
- **RF-33c.** El sistema puede generar una imagen o PDF del código de barras de un producto, lista para llevar a imprimir en una imprenta o local de stickers; no requiere una impresora de etiquetas propia.

### Modo sin conexión (obligatorio)
- **RF-34.** El puesto de caja guarda una copia local del catálogo (sin costos ni márgenes) para poder buscar productos sin internet.
- **RF-35.** Toda venta o modificación se guarda primero en el dispositivo local, con un identificador único y su hora, y se reintenta enviar a la nube automáticamente hasta lograrlo.
- **RF-36.** La pantalla muestra en todo momento si hay operaciones pendientes de sincronizar y cuántas.
- **RF-37.** Las ventas y movimientos de stock solo se agregan, nunca se sobrescriben, para que no choquen al sincronizar dos puestos a la vez.
- **RF-38.** Si dos puestos venden el mismo último lote sin conexión y el stock queda negativo, la venta no se bloquea; el caso queda marcado para revisión del administrador.
- **RF-39.** Si los precios cambian mientras una caja está sin conexión, esa caja sigue usando los precios anteriores hasta reconectar.
- **RF-40.** Además de guardarse en el navegador, las operaciones pendientes se respaldan en un segundo archivo local (disco o pendrive), para no perderse si el equipo se apaga de golpe.

### Backups
- **RF-41.** El sistema hace una copia de seguridad automática todos los días al cerrar la caja.
- **RF-42.** La copia se guarda fuera de la plataforma principal (ej. en un Drive de la dueña), no solo en la notebook.
- **RF-43.** Se puede exportar cualquier tabla a Excel a demanda.
- **RF-44.** Antes de dar el sistema por confiable, se prueba al menos una vez restaurar una copia de seguridad completa.

### Clientes y fiado
- **RF-45.** Existe una sección de Clientes con nombre y teléfono opcional, con buscador.
- **RF-46.** Cada fiado se registra como un cargo y cada pago como un abono; el saldo es la suma de ambos. Funciona igual sin conexión.
- **RF-47.** El tope de fiado por cliente no lo calcula el sistema: lo define la dueña caso por caso, según confianza.
- **RF-48.** Ajustar o perdonar una deuda (por ejemplo, por inflación) lo hace solo el administrador, manualmente.

### Reposición de stock
- **RF-49.** Cualquier empleado puede marcar un producto como "Falta / se está acabando" desde su celular.
- **RF-50.** Esas marcas arman una lista de reposición agrupada por proveedor, a modo de pedido de compra.
- **RF-51.** El ingreso de mercadería nueva es rápido: escanear el código, cargar cantidad y vencimiento.
- **RF-52.** Se hace un único conteo físico completo durante la migración inicial, para que el stock arranque con números reales; no se exige un conteo periódico posterior.

### Escalabilidad
- **RF-53.** El modelo de datos incluye desde el día uno los conceptos de sucursal, caja/puesto y usuario con rol, aunque hoy exista uno solo de cada uno.
- **RF-54.** Los datos viven en la nube como fuente única; la notebook es solo un puesto más, reemplazable sin perder información.
- **RF-55.** Agregar una caja o una sucursal nueva no requiere cambios estructurales, solo dar de alta un registro.

### Auditoría y trazabilidad
- **RF-56.** No se borran productos: se archivan, para no romper el historial de ventas pasadas.
- **RF-57.** Descartar o ajustar stock (rotura, vencido, error de conteo u otro motivo) se registra como un movimiento con su motivo, no como un simple cambio de número. Tanto Administrador como Empleado pueden hacerlo, porque es parte del trabajo diario en la caja; lo que queda exclusivo para Administrador es anular una venta ya cerrada o perdonar una deuda.
- **RF-58.** Cada cambio sobre un producto guarda quién lo hizo, cuándo y qué valor tenía antes.
- **RF-59.** El rol Administrador lo van a ocupar varias personas a la vez (las hijas de la dueña). Cada una tiene su propia cuenta; no se comparte un único login entre varias personas, porque de eso depende que el historial pueda distinguir quién hizo cada cambio.
- **RF-60.** Existe una pantalla de **Historial de modificaciones**, visible para Administrador, donde se puede buscar y filtrar por producto, por persona o por fecha, y ver qué cambió, quién lo hizo, cuándo, y el valor anterior y el nuevo. No alcanza con que el dato quede guardado atrás; tiene que poderse consultar.

### Reportes y análisis de ventas
- **RF-61.** El sistema arma un gráfico de ventas por día (o por día de la semana), para identificar qué días se vende más.
- **RF-62.** El sistema arma un ranking de productos más vendidos, por cantidad y por importe, filtrable por rango de fechas.
- **RF-63.** El sistema permite ver la demanda agrupada por rubro y por etiqueta (por ejemplo, qué proporción de las ventas es "sin TACC" o "vegano"), para detectar tendencias de consumo.
- **RF-64.** Estos reportes son de acceso exclusivo para el rol Administrador.

## 7. Requerimientos no funcionales

- **RNF-01 (Disponibilidad):** el sistema debe seguir funcionando en el puesto de caja aunque se corte la luz, el internet, o se devuelva/rompa la notebook actual.
- **RNF-02 (Rendimiento):** con ~250 productos hoy y margen para crecer, cualquier búsqueda o carga debe sentirse instantánea en un celular común.
- **RNF-03 (Compatibilidad):** debe funcionar en el navegador de la notebook (Windows 10, hardware modesto) sin instalar programas pesados, y en los celulares/tablets de los empleados.
- **RNF-04 (Seguridad de datos):** los costos y márgenes nunca deben llegar, ni ocultos, a un dispositivo con rol Empleado.
- **RNF-05 (Mantenibilidad):** preferir herramientas ya construidas y ampliamente usadas antes que código a medida, salvo que no cubran los requerimientos de lote/vencimiento/offline.
- **RNF-06 (Estética):** la interfaz debe verse elegante y cuidada, con estética de glassmorfismo (superficies translúcidas, desenfoque de fondo, sensación de profundidad) como línea visual general.
- **RNF-07 (Transiciones):** los cambios de pantalla se acompañan de una transición animada suave, no un salto brusco.
- **RNF-08 (Arquitectura front-end):** confirmado, va a ser un MPA (páginas separadas, con navegación tradicional). Para lograr igual las transiciones animadas entre pantallas (RNF-07), se usa la View Transitions API entre documentos (soportada en Chrome y Edge desde la versión 126, ambos muy por debajo de lo que corre hoy la notebook), activada con una regla CSS en cada página. Para el modo offline (RF-34 a RF-40) dentro de un MPA, la pieza clave es un Service Worker: un script que intercepta la carga de cada página y de los datos, y los sirve desde una copia local cuando no hay internet. Es standard y funciona igual de bien con MPA que con SPA; no cambia nada de lo ya definido.
- **RNF-09 (Modularidad del código):** todo el código se organiza en módulos separados por responsabilidad (por ejemplo: catálogo, ventas, sincronización offline, reportes, autenticación), con una estructura de carpetas y convenciones de nombres consistentes en todo el proyecto, para que cualquier persona o agente que continúe el desarrollo lo entienda sin releer todo de una.
- **RNF-10 (Seguridad de credenciales):** las claves de Supabase (y cualquier otra clave o secreto) nunca se escriben directamente en el código. Van en variables de entorno, en un archivo que queda excluido del repositorio (`.gitignore`). Esto es crítico porque el repositorio puede terminar siendo público en GitHub.

## 8. Fases

| Fase | Contenido |
|---|---|
| 0 | Relevamiento final y definiciones pendientes con la dueña |
| 1 | Catálogo consultable desde celular: productos, marcas, rubros, etiquetas, roles y permisos, botón de faltantes |
| 2 | Stock por lote, vencimientos, fraccionamiento y granel, códigos de barra propios |
| 3 | Caja: ventas, balanza (Opción A, sin conexión), modo offline, backups, clientes y fiado, conteo inicial |
| 4 | Más cajas, sucursales, facturación electrónica, reetiquetado por cambio de precio, posible conexión de una balanza a futuro |

## 9. Preguntas abiertas para la dueña

Por el momento no quedan preguntas pendientes. Si surge alguna nueva durante la construcción, se agrega acá.

## 10. Decisiones ya tomadas (para no volver a discutirlas)

- Los empleados no ven costos ni márgenes, solo el administrador.
- El multiplicador de precio por defecto es ×2 sobre el costo, ajustable por rubro o producto.
- No se hacen conteos físicos periódicos; se repone cuando se nota que falta algo.
- El fiado no tiene tope automático; lo decide la dueña por cliente.
- La balanza queda como instrumento aislado por ahora (Opción A); el sistema deja una interfaz genérica sin implementar, para conectar en el futuro cualquier balanza o dispositivo que se compre, sin atarse a una marca puntual.
- Los stickers con el código de barras se mandan a imprimir a una imprenta o local del barrio; no hace falta comprar una impresora de etiquetas propia. El sistema solo necesita poder generar la imagen o el PDF del código para llevarlo a imprimir.
- El local está en negro, pero el sistema deja el campo de facturación preparado para el futuro.
- Son dos roles, no tres: Administrador y Empleado. No existe un rol Consulta.
- El precio sugerido se redondea siempre a un múltiplo de 100.
- En productos a granel, se abre una sola bolsa a la vez por producto.
- La vida útil de cada producto (una vez abierto o fraccionado) la carga la dueña, con posibilidad de cargarla o modificarla para varios productos a la vez.
- La estética general es elegante, con glassmorfismo, y las pantallas cambian con una transición animada, no de golpe.
- La base de datos y backend es Supabase (Postgres).
- Las claves de Supabase van por variable de entorno, nunca escritas en el código.
- El rol Administrador lo van a tener varias personas (las hijas de la dueña), cada una con su propia cuenta, y hay una pantalla de historial de modificaciones para verlo.
- Se agregan reportes de ventas por día, por producto y por rubro/etiqueta, de acceso exclusivo para Administrador.
- El empleado puede agregar o quitar stock (con motivo) porque lo necesita en el día a día de la caja. Anular una venta cerrada o perdonar una deuda sigue siendo exclusivo del administrador.
- La arquitectura es un MPA, con transiciones animadas resueltas por la View Transitions API entre documentos, y el modo offline resuelto con un Service Worker.
- El frontend va a ser React (ver sección 11 para el detalle y por qué).

## 11. Stack tecnológico (definición inicial)

**Frontend:** React, con Vite en modo multi-página, para mantener el MPA ya elegido: cada pantalla es su propio archivo HTML con su propio punto de entrada de React, no una sola aplicación con ruteo interno. Motivos: nadie del equipo tiene experiencia previa programando, así que no pesa la comodidad humana con el código; se priorizó funciones y velocidad de desarrollo por sobre el peso mínimo; y como solo lo van a mantener agentes de IA, conviene la herramienta con la que esos agentes escriben de forma más consistente, lo que ayuda a la modularidad pedida en RNF-09.

**TypeScript (recomendado, no obligatorio):** ayuda a los agentes a cometer menos errores al conectar los distintos módulos entre sí (por ejemplo, que un campo de producto se llame igual en todas partes). No es indispensable, pero conviene como opción por defecto salvo que traiga más fricción que beneficio.

**Transiciones entre páginas:** View Transitions API entre documentos (RNF-08), activada con `@view-transition { navigation: auto; }` en cada página.

**Modo offline:** un Service Worker que cachea páginas y recursos, más almacenamiento local del navegador para la cola de operaciones pendientes (RF-34 a RF-40).

**Gráficos (RF-61 a RF-64):** una librería de gráficos liviana, por ejemplo Recharts (pensada para React) o Chart.js.

**Base de datos y backend: Supabase (Postgres).** Ya resuelto con la prueba de sincronización offline; queda descartado Firebase. Los reportes de lote, vencimiento y ventas (RF-61 a RF-64) se benefician directamente de tener una base relacional.

## 12. Asignación de tareas entre agentes de IA

Los roles de abajo son **pistas de trabajo, no nombres fijos de herramientas.** Cualquier IA (Antigravity, Codex, Claude Code, u otra) puede ocupar cualquiera de estos roles. Lo que importa es que dos agentes no editen las mismas carpetas al mismo tiempo, y que cada uno lea este documento completo antes de empezar, no solo su parte.

**Regla general de QA:** ningún agente marca su tarea como terminada si solo la probó en una máquina rápida. El modo offline y el rendimiento visual (RNF-08) se prueban en las condiciones reales: la notebook de la caja, con Edge, y simulando que se corta el internet.

### Fase 0 — Cimientos (un solo agente, no se paraleliza)

Antes de dividir el trabajo, un agente arma la base que todos los demás van a usar.

| Tarea | Qué incluye | QA / criterio de aceptación |
|---|---|---|
| Cimientos del proyecto | Estructura del repo, Vite en modo multi-página, esquema de datos completo (producto, lote, venta, cliente, usuario, historial), proyecto de Supabase configurado con ese esquema y el modo offline (RF-34 a RF-40) probado sobre Supabase, Service Worker base, sistema de login | El repo se clona y corre en limpio sin pasos manuales no documentados. El esquema implementa exactamente las entidades y campos de la sección 13. El modo offline contra Supabase funciona en la prueba antes de repartir tareas al resto de los agentes. Ninguna clave de Supabase queda escrita en el código (RNF-10); están en variables de entorno, y el archivo que las contiene no se sube al repositorio. |

### Fase 1 — Catálogo consultable (en paralelo, después de Fase 0)

| Agente | Qué construye | QA / criterio de aceptación |
|---|---|---|
| A — Catálogo y clasificación | RF-01 a RF-06 | Un Empleado busca cualquier producto de prueba desde el celular. Combinar filtro de marca + etiqueta da el resultado correcto. El administrador crea una etiqueta nueva y la asigna a varios productos en una sola acción. Exportar a Excel abre bien y coincide con lo que se ve en pantalla. |
| B — Roles, cuentas e historial | RF-59, tabla de roles, RF-58 y RF-60 | Cada administradora tiene su propio usuario. Un Empleado no puede ver costos ni márgenes ni manipulando la URL a mano. El historial de modificaciones se puede filtrar por persona, producto y fecha. |
| C — Reposición y faltantes | RF-49 a RF-51 | Marcar "falta" desde el celular toma menos de 3 toques. La lista de reposición agrupa bien por proveedor. |
| D — Sistema de diseño | RNF-06 a RNF-09 | Define colores, tipografía y componentes de base (con glassmorfismo) para que los demás agentes los usen, en vez de que cada uno invente su propio estilo. Las transiciones (View Transitions API) andan en la notebook real de la caja, no solo en una PC potente. El desenfoque no genera lag notable en el hardware Celeron/Atom. |

*Nota: conviene que el Agente D entregue una primera versión de los componentes básicos temprano, para que A, B y C ya construyan con ese estilo en vez de reetiquetar todo al final.*

### Fase 2 — Stock, lotes y fraccionamiento (después de Fase 1)

| Agente | Qué construye | QA / criterio de aceptación |
|---|---|---|
| E — Lotes y vencimientos | RF-07 a RF-10, RF-56, RF-57 | Al vender o fraccionar, descuenta primero del lote que vence antes, sin que el usuario lo elija. Archivar un producto no borra sus ventas pasadas. |
| F — Fraccionamiento y granel | RF-11 a RF-17b | Fraccionar 1000 g en bolsitas de 150 g dejando 100 g sobrantes, registra la merma correctamente. Al cerrar una bolsa granelera, no deja abrir una segunda del mismo producto mientras la primera siga activa. Cargar la vida útil de 5 productos a la vez en una sola acción funciona. |
| G — Códigos de barra propios | RF-18 a RF-23 | Un código EAN-13 generado por el sistema, impreso chico, se lee bien con el lector Nictom LCB3100. Escanear el código de un producto a granel desde la planilla del mostrador pide el peso a continuación. |

### Fase 3 — Caja (después de Fase 2; la más sensible, más revisión antes de dar por cerrada)

| Agente | Qué construye | QA / criterio de aceptación |
|---|---|---|
| H — Ventas y caja | RF-31 a RF-33 | El cierre de caja separa bien el total por medio de pago. Con la balanza sin conectar, ingresar el peso a mano calcula el importe correcto. |
| I — Modo offline y sincronización | RF-34 a RF-40 | Apagar la notebook de golpe con operaciones pendientes no pierde ninguna al reiniciar. Dos ventas hechas sin conexión en dos puestos no se pisan entre sí al reconectar. El indicador de pendientes se actualiza en tiempo real. |
| J — Backups | RF-41 a RF-44 | Restaurar una copia de seguridad completa realmente devuelve los datos. El backup automático corre solo, sin intervención, al cerrar caja. |
| K — Clientes y fiado | RF-45 a RF-48 | Un fiado y un pago posterior actualizan bien el saldo. Registrar un fiado funciona sin conexión y se sincroniza después. |

### Fase 4 — Escalabilidad y reportes (después de Fase 3)

| Agente | Qué construye | QA / criterio de aceptación |
|---|---|---|
| L — Multi-sucursal y multi-caja | RF-53 a RF-55 | Agregar una caja o sucursal nueva no pide tocar código, solo cargar un registro. |
| M — Reportes y análisis de ventas | RF-61 a RF-64 | El gráfico de ventas por día y el ranking de productos se recalculan solos al cargar nuevas ventas. Los reportes son invisibles para el rol Empleado. |
| N — Preparado para el futuro | Facturación (sección 3), reetiquetado por cambio de precio (RF-30), generación de imagen/PDF del código de barras para imprimir afuera (RF-33c), interfaz genérica sin implementar para conectar una balanza a futuro (RF-33b) | Ninguna de estas cosas requiere tocar la base de datos existente para activarse el día de mañana. El PDF de códigos de barras se puede llevar tal cual a una imprenta local. |

### QA de integración (transversal a todas las fases)

El QA por agente de las tablas de arriba no alcanza solo: hay que probar también que los módulos hechos por distintos agentes funcionan bien juntos, antes de dar una fase por cerrada.

- Una venta registrada por Caja (H) descuenta correctamente el stock que gestiona Lotes (E), del lote que corresponde.
- Un producto nuevo cargado desde Catálogo (A) aparece bien en el botón de faltantes (C) y, una vez que tiene ventas, en los Reportes (M).
- Archivar un producto (RF-56) no rompe ni oculta las ventas ya registradas que lo incluyen.
- El Historial de modificaciones (B) refleja correctamente cambios hechos desde Catálogo (A), Lotes (E) y Fraccionamiento (F), no solo los suyos propios.
- Un fiado cargado desde Caja (H) y un pago registrado después actualizan el mismo saldo de Clientes (K), sin duplicar movimientos.
- Una etiqueta o rubro nuevo, creado por el administrador desde Catálogo (A), se ve reflejado igual en el filtro de demanda de Reportes (M).

## 13. Modelo de datos (resumen de entidades)

Esta es la traducción de los requerimientos funcionales a tablas concretas. El agente de Fase 0 (Cimientos) implementa exactamente esto; el resto de los agentes lo consumen, no lo redefinen.

**Producto**

| Campo | Notas |
|---|---|
| id | |
| nombre | |
| código_barras | del fabricante, o generado internamente (RF-20) |
| marca_id | incluye "Del local" como marca (RF-06) |
| rubro_id | admite un rubro_padre_id opcional, para subrubros |
| etiquetas | relación varios a varios, lista abierta y editable por el administrador (RF-03) |
| unidad_base | gramos, mililitros o unidad |
| multiplicador_precio | opcional; si no está definido, se usa el general (×2, RF-25) |
| vida_útil_post_apertura_dias | opcional, la carga la dueña (RF-17) |
| rótulo | ingredientes y alérgenos, texto libre |
| activo | en `false` significa archivado, nunca se borra (RF-56) |

**Presentación** (una fila por cada forma de venta del mismo producto)

| Campo | Notas |
|---|---|
| id | |
| producto_id | |
| nombre | ej. "150 g", "granel por kg" |
| cantidad_base | en la unidad base del producto |
| código_barras_propio | para granel y fraccionados del local (RF-20, RF-21) |

**Lote**

| Campo | Notas |
|---|---|
| id | |
| presentación_id | |
| proveedor_id | |
| cantidad_inicial / cantidad_actual | |
| costo_compra | visible solo para Administrador (RNF-04) |
| fecha_ingreso | |
| fecha_vencimiento_fabricante | |
| fecha_apertura | nullable, para granel (RF-11) |
| fecha_fraccionamiento | nullable (RF-14) |
| estado | abierto o cerrado (RF-15) |

**Proveedor** y **ProveedorProducto**

| Campo | Notas |
|---|---|
| proveedor: id, nombre, contacto | |
| relación: producto_id, proveedor_id, código_proveedor, costo, fecha_última_compra, es_principal | un proveedor marcado como principal por producto (RF-24) |

**Venta** y **VentaItem**

| Campo | Notas |
|---|---|
| id, id_local | `id_local` se genera en el dispositivo antes de sincronizar, para no duplicar ventas (RF-35) |
| fecha_hora, puesto_id, usuario_id | |
| medio_pago | efectivo, transferencia o QR (RF-31) |
| cliente_id | nullable; se usa cuando la venta es fiado |
| estado | cerrada o anulada (anular es solo Administrador, sección 5) |
| sincronizado | booleano, para el modo offline |
| ítems | presentación_id, lote_id, cantidad, precio_unitario |

**MovimientoStock**

| Campo | Notas |
|---|---|
| tipo | ingreso, venta, fraccionamiento, merma, ajuste o descarte (RF-57) |
| producto_id, lote_id, cantidad, motivo, usuario_id, fecha_hora | |
| sincronizado, id_local | mismo criterio que Venta, para el modo offline |

**Cliente** y **MovimientoFiado**

| Campo | Notas |
|---|---|
| cliente: id, nombre, teléfono, tope_fiado | teléfono y tope son opcionales; el tope lo define la dueña caso por caso (RF-47) |
| movimiento: tipo (cargo/abono), monto, fecha, usuario_id, venta_id | el saldo del cliente es la suma de sus movimientos, nunca un campo que se pisa (RF-46) |

**Usuario**

| Campo | Notas |
|---|---|
| nombre, usuario o email, contraseña (hasheada), rol | rol es Administrador o Empleado únicamente (sección 5, RF-59) |

**HistorialCambios**

| Campo | Notas |
|---|---|
| entidad, entidad_id, campo, valor_anterior, valor_nuevo, usuario_id, fecha_hora | alimenta la pantalla de historial de modificaciones (RF-60) |

**Sucursal** y **Puesto**

| Campo | Notas |
|---|---|
| sucursal: id, nombre, dirección | hoy hay una sola (RF-53) |
| puesto: id, sucursal_id, nombre o identificador | hoy hay uno solo, el de la caja actual |

**Marca, Rubro, Etiqueta** (tablas de referencia)

Cada una es simplemente `id` y `nombre` (Rubro suma un `rubro_padre_id` opcional para subrubros). Las tres las administra libremente el rol Administrador (RF-03).

> Todo campo de costo, precio de compra o margen vive detrás del control de acceso de RNF-04: nunca debe llegar, ni oculto, a la copia de datos que recibe un dispositivo con rol Empleado.

## 14. Flujo de integración de código (Git)

Con varios agentes tocando el mismo repositorio, esta es la forma de que el trabajo se vaya juntando sin pisarse, y de que vos puedas revisarlo desde VS Code antes de aceptarlo.

- **Una rama por agente/tarea**, nombrada por el rol de la sección 12 (por ejemplo `agente-a-catalogo`, `agente-e-lotes`). Nadie escribe directamente sobre `main`.
- **Cada tarea de la sección 12 termina en un Pull Request hacia `main`**, con una descripción corta de qué RF cubre y qué QA de esa misma tabla pasó.
- **Vos revisás el Pull Request desde VS Code** (clonando el repo o con la extensión de Claude Code) antes de fusionarlo, mirando el diff de archivos. En la Fase 3 (caja, la más sensible) conviene revisar con más cuidado que en las demás.
- **Orden de fusión dentro de una fase:** primero el agente del que dependen los demás (por ejemplo, el Agente D de diseño en la Fase 1, porque los otros usan sus componentes), después el resto en el orden en que vayan terminando.
- **Si dos agentes tocan el mismo archivo compartido** (típicamente el esquema de tipos de la Fase 0), el que termina después resuelve el conflicto contra la versión más nueva de `main`, nunca al revés.
- **Commits chicos y descriptivos**, uno por cada pieza de funcionalidad (por ejemplo, "agrega filtro por etiqueta al catálogo"), no un solo commit gigante al final de toda la tarea. Así, si algo sale mal, se puede volver a un punto anterior sin perder todo lo demás.
