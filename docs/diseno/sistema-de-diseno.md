# Alverde — design system (paquete para otra IA)

Este archivo junta todo el sistema visual de Alverde, la app de gestión de una dietética en Argentina: reglas, decisiones, tokens, componentes, pantallas e inventario de acciones. Es la fuente de verdad.

**Cómo usarlo si sos una IA que va a implementar o seguir diseñando:**
- Respetá los nombres de tokens tal cual (`--color-fondo`, `--esp-m`, `--mov-curva`, …): son los del código.
- Dos temas con la misma estructura: `data-theme="botanical"` (claro) y `data-theme="midnight"` (oscuro) en `<html>`.
- Cargá `tokens.css` y después `bundle.css` (clases en español: `boton`, `campo`, `carta`, `tabla`, `modal`, shell `app-sidebar` / `app-header` / `app-content`). Ver el marcado de cada componente en `componentes/<Nombre>/preview.html` del .zip.
- No agregues acciones, métricas ni datos que no estén en la sección Inventario. Un empleado nunca ve costos, márgenes ni multiplicadores (RNF-04).
- Español rioplatense con voseo, tipo oración, sin emojis.


---

<!-- README -->

# Guía general

Alverde es el sistema de gestión de una dietética en Argentina. Lo usan dos personas: el empleado, en la caja durante turnos de 6 a 8 horas, en una notebook modesta con lector de código de barras, y la administradora, que además maneja precios, costos, sucursales y reportes. Este sistema tiene un solo objetivo por encima de todos: que ocho horas mirando la pantalla cansen menos. Lo premium sale de la contención: tipografía cuidada, un solo acento, profundidad sutil.

Hay dos temas con la misma estructura y distintos valores: **Botanical Living** (claro, verde bosque sobre blanco hueso) y **Midnight Bio Precision** (oscuro, lima suave sobre verde casi negro). Se eligen con `data-theme="botanical"` o `data-theme="midnight"` en `<html>`.

## Cómo usarlo

- Cargá `tokens.css` (se genera de `tokens.json`) y después `components/bundle.css`. Todo valor sale de un token: `var(--color-acento)`, `var(--esp-l)`, `var(--texto-m)`. No escribas colores, tamaños ni duraciones sueltos.
- Los nombres de los tokens son los del código: `--color-fondo`, `--color-tinta`, `--carta-fondo`, `--esp-m`, `--mov-curva`, etc.
- Las clases de `bundle.css` están en español y sin prefijo: `boton`, `campo`, `entrada`, `selector`, `chip`, `estado`, `carta`, `kpis`, `tabla`, `lista`, `modal`, `opciones`, `nav-sec`, y el shell `app-sidebar`, `app-header`, `app-content`.
- Las pantallas usan el mismo marcado en escritorio y celular; el cambio lo hace una consulta de contenedor a 720 px.

## Contenido y voz

- Español rioplatense con voseo: «Escaneá el código», «Elegí el medio de pago», «Ingresá a tu cuenta», «Revisá la fecha».
- Los botones dicen qué pasa: «Cobrar $17.120», «Ingresar lote», «Confirmar 24 cambios», «Avisar que falta». Nada de «Aceptar» genérico ni de códigos internos (RF-xx, FEFO, IndexedDB) en pantalla.
- Los nombres de botones, campos y pestañas son los del código. Los pocos que cambian están en la sección Inventario, con el nombre anterior al lado.
- Tipo oración en títulos, botones y estados. Las mayúsculas espaciadas existen sólo en 12 px: encabezados de tabla, grupos de la navegación secundaria y rótulos de subsección.
- Números en formato argentino: `$14.800`, `0,450 kg`, `09/10/2026`, `08:02`. Precio por kg con la unidad chica: `$14.800 /kg`.
- Errores que dicen qué pasó y cómo seguir, sin disculpas: «Revisá la fecha: noviembre tiene 30 días.»
- Sin emojis.

## Color

- **Un solo acento por pantalla.** `color-acento` es para la acción principal (Cobrar, Ingresar, Ingresar lote, Nuevo cliente) y para el estado activo (ítem de navegación, chip u opción elegidos, foco). Nunca para totales, títulos, íconos sueltos ni gráficos.
- Texto en tres niveles: `color-tinta` (principal y cifras), `color-tinta-suave` (etiquetas, encabezados, meta), `color-tinta-apagada` (placeholders, notas, barras de gráficos). Todos pasan AA sobre `color-fondo`, `carta-fondo`, `input-fondo` y `boton-secundario-fondo` en los dos temas.
- Sobre un relleno de acento o de `color-error-fuerte`, el texto es `color-acento-tinta`, nunca blanco o negro literal.
- Estados: `color-exito` (verde azulado, para separarse del acento y del error), `color-aviso`, `color-error`, `color-error-fuerte` (sólo «Vencido» y el peligro activo). Siempre con ícono y palabra.
- Fondos calmos: `color-fondo` es un blanco hueso apenas verde en Botanical y un verde casi negro en Midnight. En Midnight el texto es gris verdoso (`#d6dccf`), nunca blanco puro sobre negro puro.
- Midnight no tiene brillos ni glow. La lima del acento está desaturada y es lo más luminoso de la pantalla.

## Tipografía

- **Manrope** (`--fuente`) para toda la interfaz, campos y placeholders incluidos, con cifras tabulares.
- **Plus Jakarta Sans** (`--fuente-titulos`) en 600 para títulos de página, de modal y de sección.
- **JetBrains Mono** (`--fuente-datos`) sólo para cifras y códigos: precios, pesos, cantidades, fechas en tablas, lotes, EAN.
- Escala de cinco tamaños: `texto-xs` 12, `texto-s` 14, `texto-m` 16, `texto-l` 20, `texto-titulo` 24. Cuerpo entre 14 y 16. Un sexto valor, `texto-cifra` 48, sólo para el TOTAL de la caja: se lee a 1 m.
- Pesos: 400 para texto, 500 para cifras y navegación, 600 para títulos y botones. La marca usa 700.

## Espacio, radios y bordes

- Ritmo de cinco pasos: `esp-xs` 4, `esp-s` 8, `esp-m` 16, `esp-l` 24, `esp-xl` 32. Relleno de carta `esp-l` (16 en celular); separación entre bloques `esp-l`; margen lateral en celular `esp-m`.
- Controles de 44 px de alto (táctil). Chips de 36 px con área táctil de 44. Cobrar mide 64.
- `radio-control` = `radio-boton` = 8 px, así un campo y un botón en la misma fila son un par. `radio-carta` = 12 px.
- Las superficies se separan con bordes de 1 px (`carta-borde`, `color-linea`); la sombra (`carta-sombra`) apenas apoya.

## Profundidad y vidrio

- Como máximo dos superficies con desenfoque por pantalla: la cabecera fija (`app-header`) y el modal abierto. Todo lo demás es opaco.
- El vidrio es `glass-fondo` (90 % opaco) + `glass-blur` 12 px + `glass-borde` + `glass-sombra`. Sin desenfoque (navegador viejo, `prefers-reduced-transparency`) se reemplaza por `carta-fondo` y se lee igual.

## Interacción y accesibilidad

- Foco de teclado visible en todo: outline sólido de 2 px `foco-anillo` con 2 px de separación (1 px en campos). Es un color, no una sombra.
- Objetivos táctiles de 44 px. Botones sólo de ícono con `aria-label`.
- Ningún estado depende sólo del color: tilde en chips y opciones, ícono y palabra en estados, porcentaje escrito al lado de cada medidor.
- Microinteracciones: hover con velo `color-hover` en `mov-rapido`, presión de 1 px, modal que entra en `mov-normal`. Todo con `mov-curva`. Ver la sección Movimiento para las transiciones entre páginas.
- Estados comunes: esqueletos al cargar (la única animación continua), lista vacía con una frase, error en rojo con ícono, «Guardado.» con tilde, «Guardando…» deshabilitado.
- Lo que no se puede deshacer pide confirmación en un diálogo: Anular venta, Unir con…, convertir a balanza.

## Iconografía

- Material Symbols Outlined, peso 400, relleno 0, el set que ya usa la app. Están copiados como SVG dentro de `bundle.css` y se usan con `<span class="ic ic-search" aria-hidden="true"></span>`; funcionan sin conexión y toman el color del texto.
- 20 px por defecto, 16 en chips, estados y botones compactos, 24 en Cobrar.

## Marca

- No hay archivo de logo entre las fuentes. La marca es la palabra «alverde» en minúscula, Plus Jakarta Sans 700, `color-acento`, con la bajada «Dietética natural» en `texto-xs`. No dibujes un isotipo.
- Sin fotos de producto: el catálogo se reconoce por nombre, marca, rubro y precio.

## Lo que no se muestra

- **RNF-04:** el empleado nunca ve costos, márgenes ni multiplicadores, en ningún tema ni estado. Sólo aparecen en Administración (Márgenes, Productos, Precios sugeridos).
- Lo marcado `[Admin]` en el código se muestra sólo a la administradora: Administración, el selector de sucursal, Traspasar, el tope del cliente y el Ajuste de cuenta.
- Ningún dato ni acción que no exista en el código: nada de contadores, métricas de eficiencia, latencias, puertos, fotos ni atajos de teclado inventados. Si queda espacio, se resuelve con jerarquía, no con relleno.


---

<!-- decisiones.md -->

# Decisiones

Una nota por decisión: qué problema resuelve y por qué así.

## Color y fatiga

**Un solo acento por pantalla.** Problema: en Midnight los botones, chips, navegación y totales brillaban en lima y todo competía. Decisión: `color-acento` sólo para la acción principal y el estado activo. Por qué: si una sola cosa tiene color, el ojo la encuentra sin buscar y descansa en el resto.

**Midnight sin glow, lima desaturada.** Problema: los halos y el lima saturado (#d3fa99 con sombra de color) generan destellos en pantallas mal calibradas. Decisión: `#a8cc80` sin sombras de color; `boton-sombra` es una sombra negra de 1 px. Por qué: la luminancia alta ya destaca; el halo sólo suma vibración.

**Sin blanco puro sobre negro puro.** Problema: el contraste extremo (21:1) produce halos en los bordes de las letras en uso prolongado. Decisión: `color-tinta` de Midnight es `#d6dccf` sobre `#111511` (13:1). Por qué: holgadamente AAA y más cómodo durante ocho horas.

**Fondos calmos.** Problema: el fondo de Botanical (`#f2fde8`) era un verde saturado que tiñe toda la pantalla, con manchas de luz decorativas. Decisión: `color-fondo` `#f1f3ed`, casi neutro, y ningún gradiente ambiental. Por qué: el fondo no debe pedir atención; el verde queda para la marca y el acento.

**El TOTAL no es verde.** Problema: el total y el botón competían con el mismo color. Decisión: el total va en `color-tinta` y tamaño grande; el verde queda para Cobrar. Por qué: el tamaño ya le da jerarquía, y el color marca dónde tocar.

**Éxito verde azulado.** Problema: con el acento verde y el error rojo, un éxito verde se confunde con el acento y, en daltonismo, con el error. Decisión: `color-exito` tira al azul (`#0e6472` / `#86d2c8`). Por qué: se separa del acento y del rojo; igual siempre va con ícono y palabra.

**Severidad en forma, no sólo en color.** Problema: los estados se distinguían sólo por color. Decisión: los cuatro valores del filtro del código, En regla → Por vencer · 18 días → Crítico · 3 días → Vencido, con ícono distinto y sólo «Vencido» relleno. Por qué: se lee en escala de grises, en daltonismo y de reojo.

## Tipografía

**Mono sólo para cifras y códigos.** Problema: campos y placeholders en JetBrains Mono se leían peor. Decisión: Manrope con cifras tabulares en toda la interfaz; JetBrains Mono para precios, pesos, cantidades, fechas en tablas, lotes y EAN. Por qué: el texto se lee mejor en proporcional y los números siguen alineados.

**Cinco tamaños más una cifra.** Problema: más de diez estilos de texto, de 10 a 44 px, sin jerarquía clara. Decisión: 12 · 14 · 16 · 20 · 24, cuerpo entre 14 y 16, y un 48 sólo para el TOTAL. Por qué: menos tamaños dan una jerarquía que se entiende sola; el 48 es un display, no un tamaño de lectura.

**TOTAL legible a 1 m.** Problema: quien atiende mira el total desde el mostrador. Decisión: 48 px JetBrains Mono 600 y Cobrar de 64 px con etiqueta de 24 px. Por qué: en una pantalla de 14″ a 1366 px, 48 px dan cifras de unos 8 mm de alto, cómodas a un metro.

**Mayúsculas espaciadas sólo en 12 px.** Problema: etiquetas en mayúsculas por todos lados («ESTADO BALANZA USB», «PROTOCOLO TIENDA») gritan y se leen lento. Decisión: sólo en encabezados de tabla, grupos de navegación secundaria y rótulos de subsección. Por qué: en tamaños chicos ayudan a separar rótulo de dato; en el resto, el tipo oración se lee más rápido.

## Jerarquía y estructura

**Una acción principal por pantalla.** Problema: varias pantallas tenían tres o cuatro botones con el mismo peso. Decisión: Cobrar en Caja, Ingresar lote en Stock, Nuevo cliente en Clientes, la acción que guarda en cada sección de Administración y la que confirma en cada diálogo; Catálogo no tiene, porque su acción es buscar. Todo lo demás es secundario o fantasma. Por qué: la pantalla responde sola «qué hago acá».

**Resumen arriba, detalle abajo, y sólo con datos reales.** Problema: los prototipos tenían tarjetas KPI con números que el código no calcula. Decisión: la franja de KPI aparece sólo donde el sistema ya tiene esos números (subas, bajas y total antes de confirmar precios; saldo, tope y teléfono del cliente), siempre arriba del detalle. Por qué: se lee primero el resumen, y nada en pantalla promete un dato que no existe.

**Menos tarjetas.** Problema: todo era una carta con sombra y radio grande. Decisión: carta sólo para objetos (panel de cobro, tabla, ficha, producto); el resto vive sobre el fondo. Por qué: si todo está en una caja, nada se destaca.

**Título una sola vez.** Problema: «Administración» en la cabecera y «Panel de Administración» abajo. Decisión: el título de la página vive sólo en `app-header`; el contenido arranca con la sección. Por qué: el espacio vertical de 768 px es escaso y repetir no informa.

**Administración en cinco grupos.** Problema: 13 pestañas con emoji en una fila, el título repetido y Márgenes sin lugar. Decisión: navegación secundaria vertical con Ventas · Mercadería · Productos y precios · Negocio · Sistema (14 secciones con Márgenes); en celular, un select con grupos. Por qué: se encuentra por categoría, entra todo y escala sin desbordar.

**Acción contextual por fila.** Problema: cuatro acciones (Abrir bolsa, Fraccionar, Ajustar, Traspasar) en cada lote. Decisión: la que corresponde al estado va visible; todas, incluida esa, están en «Más acciones», con Abrir bolsa deshabilitado y su motivo cuando ya hay una abierta. Por qué: la fila dice qué conviene hacer, queda limpia y no se pierde ninguna acción.

**Marca y Rubro como select.** Problema: en el código los tres ejes del catálogo son chips, y marcas y rubros crecen con los datos. Decisión: Marca y Rubro en select con «Todas» / «Todos»; Etiqueta sigue en chips con «Todas» primero. Por qué: la barra entra en una línea a 1366 px y en dos en el celular, y las etiquetas, que son pocas y se combinan, quedan a un toque.

**Una sola copia de cada herramienta.** Problema: Ingreso rápido, la tabla de lotes y los traspasos estaban en Stock y repetidos en Administración. Decisión: viven en Stock; en Administración queda un botón que lleva ahí. Por qué: un solo formulario que aprender y mantener, sin perder el acceso desde Administración.

**Medio de pago como mosaicos.** Problema: es el control más usado de la caja. Decisión: cuatro opciones de 56 px a la vista, con tilde en la elegida. Por qué: un toque, sin abrir menús, y el estado no depende del color.

**El cobro no se desplaza.** Problema: con tickets largos, el total y Cobrar quedaban fuera de vista. Decisión: panel de cobro fijo en escritorio y barra de cobro fija en celular. Por qué: lo que se mira en cada venta tiene que estar siempre en el mismo lugar.

## Profundidad, rendimiento y accesibilidad

**Dos superficies de vidrio como máximo.** Problema: blur en barra lateral, cabecera, cartas y pastillas; en un Celeron eso cuesta cuadros. Decisión: desenfoque sólo en cabecera y modal, con `glass-fondo` al 90 %. Por qué: el efecto se nota donde el contenido pasa por debajo y sin desenfoque se ve igual.

**Confirmar lo que no se deshace.** Problema: Anular una venta no pedía confirmación. Decisión: diálogo con la pregunta en el título («¿Anular la venta C1-1288?»), la consecuencia escrita y Anular venta en peligro relleno; el mismo patrón para Unir con… y convertir a balanza. Por qué: el error más caro de la app pasa a costar un toque más.

**Bordes antes que sombras.** Problema: sombras neumórficas dobles (clara y oscura) y radios de 28 px. Decisión: borde de 1 px, `carta-sombra` mínima, radios 8 y 12. Por qué: profundidad sutil y coherente, más barata de dibujar y legible en los dos temas.

**Foco como color sólido.** Problema: el foco era un halo verde al 18 %, invisible para quien usa teclado o lector de códigos. Decisión: `foco-anillo` sólido (≥ 6:1) en outline de 2 px con separación. Por qué: visible en cualquier superficie y respeta el modo de alto contraste de Windows.

**44 px para todo lo que se toca.** Problema: chips y botones de 28 a 36 px. Decisión: controles de 44 px; chips de 36 con área táctil de 44 y de 44 en pantallas táctiles. Por qué: menos toques errados en el celular y en mostrador.

**Formato argentino.** Problema: pesos como «0.450 kg». Decisión: coma decimal y punto de miles: `0,450 kg`, `$14.800`. Por qué: así se lee en la dietética y en el ticket.

**Íconos sin conexión.** Problema: Material Symbols se pedía a Google; sin internet los íconos desaparecen. Decisión: los SVG del mismo set van como máscaras en `bundle.css`. Por qué: la app tiene que funcionar offline.

## Agregados y supuestos

- **Agregados a la lista de tokens:** `texto-cifra` (48 px, el TOTAL). Todo lo demás usa exactamente los nombres del código.
- **Agregados a la lista de componentes:** `Opciones` (medio de pago y segmentos) y `NavSecundaria` (Administración), por las razones de arriba.
- **Renombres de acciones:** están todos en la sección Inventario, con el nombre del código al lado.
- **Interpretación de `--color-acento-tinta`:** es la tinta que va **sobre** el acento (y sobre `color-error-fuerte`). Para texto en color de acento se usa `--color-acento`, que pasa AA sobre fondo y carta en los dos temas.
- **Interpretación de `--foco-anillo`:** es un color, pensado para `outline: 2px solid var(--foco-anillo)`.


---

<!-- accesibilidad.md -->

# Accesibilidad y rendimiento

Contraste medido con la fórmula de WCAG 2 sobre los valores de `tokens.json`. Todos los pares de texto pasan AA en los dos temas; los bordes de control y el foco pasan 3:1.

| Par | Botanical | Midnight | Mínimo |
| --- | --- | --- | --- |
| `color-tinta` sobre `color-fondo` | 14,4:1 | 13,2:1 | 4,5:1 |
| `color-tinta` sobre `carta-fondo` | 15,7:1 | 12,2:1 | 4,5:1 |
| `color-tinta-suave` sobre `carta-fondo` | 8,2:1 | 7,7:1 | 4,5:1 |
| `color-tinta-apagada` sobre `carta-fondo` | 5,5:1 | 5,4:1 | 4,5:1 |
| `color-tinta-apagada` sobre `boton-secundario-fondo` | 4,7:1 | 4,7:1 | 4,5:1 |
| `color-acento` sobre `carta-fondo` | 6,7:1 | 9,5:1 | 4,5:1 |
| `color-acento-tinta` sobre `color-acento` | 6,6:1 | 9,3:1 | 4,5:1 |
| `color-acento-tinta` sobre `color-error-fuerte` | 8,4:1 | 9,5:1 | 4,5:1 |
| `color-exito` sobre `carta-fondo` | 6,6:1 | 9,8:1 | 4,5:1 |
| `color-aviso` sobre `carta-fondo` | 5,9:1 | 8,8:1 | 4,5:1 |
| `color-error` sobre `carta-fondo` | 6,2:1 | 6,2:1 | 4,5:1 |
| `input-borde` sobre `input-fondo` | 3,7:1 | 3,6:1 | 3:1 (borde/foco) |
| `input-borde` sobre `carta-fondo` | 3,5:1 | 3,3:1 | 3:1 (borde/foco) |
| `foco-anillo` sobre `color-fondo` | 6,2:1 | 10,2:1 | 3:1 (borde/foco) |
| `foco-anillo` sobre `carta-fondo` | 6,7:1 | 9,5:1 | 3:1 (borde/foco) |

Los estados sobre su propio tinte al 14 % (insignias) quedan entre 4,9:1 y 7,3:1.

## Reglas

- Ningún estado se comunica sólo con color: ícono y palabra en estados, tilde en chips y opciones, la cifra escrita junto a cada medidor, «Vencido» es el único relleno sólido.
- Un control deshabilitado dice por qué al lado: «Elegí una sucursal para avisar que falta», «Ya hay una bolsa abierta de este producto», «Para crear un cliente necesitás conexión».
- Lo que no se puede deshacer (Anular venta, Unir con…, convertir a balanza) pasa por un diálogo de confirmación con la consecuencia escrita.
- Botones de ícono con `aria-label` que nombra el objeto: «Quitar Nuez mariposa extra blanca del ticket», «Más acciones para Spirulina».
- `color-aviso` y `color-error` se separan poco para quien no distingue rojo y verde en Botanical (los dos son oscuros para pasar AA como texto); por eso aviso usa el triángulo `warning` y error el círculo `error` o `block`, siempre.
- Foco visible en todo control: `outline` de 2 px en `foco-anillo`. En modo de alto contraste de Windows el outline y los íconos (`CanvasText`) siguen visibles.
- Objetivos de 44 px; el texto de los campos es de 16 px para que el celular no haga zoom al enfocar.
- Gráficos: cada barra tiene `title` con su valor y el gráfico de ventas por día tiene una tabla equivalente para lectores de pantalla.

## Rendimiento en la notebook de la caja

- Desenfoque sólo en dos superficies: `app-header` y el modal. El velo del modal oscurece pero no desenfoca.
- Sin sombras grandes ni gradientes de fondo. Lo único que se anima solo es el esqueleto mientras carga (un pulso de opacidad de 1,2 s), y se apaga con `prefers-reduced-motion`.
- Las animaciones sólo tocan `opacity` y `transform`.
- Las tres fuentes son variables y latinas (25 a 40 kB cada una) y los íconos van dentro de `bundle.css`: no hay pedidos a la red.
- Con `prefers-reduced-transparency` o sin soporte de `backdrop-filter`, las superficies de vidrio pasan a `carta-fondo`.


---

<!-- movimiento.md -->

# Movimiento

El movimiento confirma lo que pasó y orienta entre páginas; nunca decora. Tres tokens lo gobiernan todo:

| Token | Valor | Uso |
| --- | --- | --- |
| `mov-rapido` | 150 ms | hover, presión, foco, salida del contenido al cambiar de página, fundido con movimiento reducido |
| `mov-normal` | 220 ms | entrada del contenido, deslizamiento del ítem activo, apertura de modal |
| `mov-curva` | `cubic-bezier(0.2, 0, 0, 1)` | curva única: arranca rápido y frena suave, sin rebote |

Sólo se animan opacidad y transform: la notebook de la caja no tiene que recalcular el layout en ningún cuadro.

## Transiciones entre páginas

Alverde es una MPA: cada sección es un documento. Con `@view-transition { navigation: auto; }` en las dos páginas, el navegador fotografía la página vieja y la nueva y anima los bloques con nombre:

| Bloque | `view-transition-name` | Qué hace |
| --- | --- | --- |
| Barra lateral | `app-sidebar` | Se queda quieta (sin animación). |
| Ítem activo | `nav-activo` (sólo el `span.nav__indicador` del ítem actual) | Se desliza del ítem anterior al nuevo en `mov-normal`. En celular se mueve en horizontal por la barra inferior. |
| Cabecera | `app-header` | Quieta. Su título tiene nombre propio. |
| Título | `app-titulo` | Fundido con 4 px de desplazamiento: el viejo sale hacia arriba en `mov-rapido`, el nuevo entra desde abajo en `mov-normal`. |
| Contenido | `app-content` | El viejo se desvanece en `mov-rapido`; el nuevo aparece subiendo 10 px en `mov-normal`. |

La raíz no se anima (`root` sin animación) para que no haya un fundido de página entera encima de los bloques. Con `prefers-reduced-motion: reduce` nada se desplaza: el título y el contenido hacen sólo un fundido de 150 ms lineal y el ítem activo salta.

Funciona en Edge y Chrome 126 o posterior y en Safari 18.2 o posterior. En un navegador sin soporte la navegación es instantánea, sin errores.

## CSS listo para usar

Va en la hoja de todas las páginas (ya está al final de `components/bundle.css`). El marcado sólo necesita las clases `app-sidebar`, `app-header`, `app-titulo`, `app-content` y el `span.nav__indicador` dentro del ítem con `aria-current="page"`; cada una ya declara su `view-transition-name`.

```css
.app-sidebar   { view-transition-name: app-sidebar; }
.nav__indicador { view-transition-name: nav-activo; }  /* existe sólo en el ítem activo */
.app-header    { view-transition-name: app-header; }
.app-titulo    { view-transition-name: app-titulo; }
.app-content   { view-transition-name: app-content; }

/* ── 17. Transiciones entre páginas (MPA, View Transitions entre documentos) ── */
@view-transition { navigation: auto; }
::view-transition-group(*) { animation-duration: var(--mov-normal); animation-timing-function: var(--mov-curva); }
::view-transition-old(root), ::view-transition-new(root) { animation: none; }
/* app-sidebar y el resto de app-header quedan quietos */
::view-transition-group(app-sidebar), ::view-transition-old(app-sidebar), ::view-transition-new(app-sidebar),
::view-transition-group(app-header), ::view-transition-old(app-header), ::view-transition-new(app-header) { animation: none; }
/* el ítem activo se desliza al nuevo ítem: lo anima el grupo nav-activo con la duración y curva de arriba */
/* app-header: el título hace fundido con un leve desplazamiento */
::view-transition-old(app-titulo) { animation: vt-titulo-sale var(--mov-rapido) var(--mov-curva) both; }
::view-transition-new(app-titulo) { animation: vt-titulo-entra var(--mov-normal) var(--mov-curva) both; }
/* app-content: fundido + subida de 10 px */
::view-transition-group(app-content) { animation: none; }
::view-transition-old(app-content) { animation: vt-sale var(--mov-rapido) var(--mov-curva) both; }
::view-transition-new(app-content) { animation: vt-entra-subiendo var(--mov-normal) var(--mov-curva) both; }
@keyframes vt-sale { to { opacity: 0; } }
@keyframes vt-aparece { from { opacity: 0; } }
@keyframes vt-entra-subiendo { from { opacity: 0; transform: translateY(10px); } }
@keyframes vt-titulo-sale { to { opacity: 0; transform: translateY(-4px); } }
@keyframes vt-titulo-entra { from { opacity: 0; transform: translateY(4px); } }

/* ── 18. Movimiento reducido: sólo un fundido corto ──────────────────── */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
  ::view-transition-old(app-content), ::view-transition-old(app-titulo) { animation: vt-sale var(--mov-rapido) linear both !important; }
  ::view-transition-new(app-content), ::view-transition-new(app-titulo) { animation: vt-aparece var(--mov-rapido) linear both !important; }
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  .boton:active { transform: none; }
}
```

## Microinteracciones

- Botones, chips, opciones y filas: el hover suma el velo `color-hover` en `mov-rapido`. Al presionar, el botón baja 1 px.
- Carta interactiva (tarjeta de producto): pasa de `carta-sombra` a `carta-hover-sombra` en `mov-normal`.
- Modal: entra con fundido, 8 px de subida y escala de 0,98 a 1 en `mov-normal`.
- Nada titila, late ni gira en reposo: los indicadores de estado son fijos.


---

<!-- inventario.md -->

# Inventario

Cada acción, campo, diálogo y pestaña del código (`main`, 9/10/2026) y dónde vive en el diseño. Nada se eliminó y no se agregó ninguna acción ni dato. «Igual» quiere decir que conserva el nombre del código.

## Renombres

| En el código | En el diseño | Por qué |
| --- | --- | --- |
| Diseño: Botanical / Midnight | Tema: Botanical / Midnight | «Diseño» se confunde con el diseño de la página; «tema» es la palabra de uso común. |
| Lotes (FEFO) | Lotes y vencimientos | FEFO es jerga técnica; la pestaña sirve para revisar vencimientos. |
| Cercanía de vencimiento (FEFO) | Vence primero | Dice el orden en dos palabras. |
| Semáforo de vencimiento | Vencimiento | El rótulo del filtro; los valores siguen iguales (Cualquiera, Vencidos, Críticos ≤ 7 días, Por vencer ≤ 30 días, En regla). |
| Ingresar Lote · Confirmar Movimiento · Confirmar Fraccionamiento | Ingresar lote · Confirmar movimiento · Confirmar fraccionamiento | Tipo oración en toda la interfaz. |
| Columna «Producto/Presentación» de la tabla de lotes | Producto · presentación | Mismo dato, con el separador del sistema. |
| Exportar Excel (Catálogo, celular) · Nuevo cliente (celular) | Excel · Nuevo | Sólo en 390 px, para que entren en una línea; en escritorio, igual. |
| Código o nombre del producto (placeholder) | Código o nombre | Entra completo en celular; la etiqueta accesible conserva el texto largo. |
| 13 pestañas con emoji + «Panel de Administración» | Navegación secundaria en 5 grupos, sin emoji, título una vez | Ver Administración. |

## Cambios de forma (sin cambio de nombre)

- **Marca y Rubro del Catálogo:** de chips a select, con «Todas» / «Todos». Etiqueta sigue en chips, con «Todas» primero.
- **Acciones por lote:** la que corresponde queda visible; Abrir bolsa, Fraccionar, Ajustar y Traspasar están todas en «Más acciones».
- **Medio de pago:** radios como mosaicos.
- **Rango de Reportes, Movimiento de cuenta, Baja / Sube la deuda, Aplicar a:** radios como segmento.
- **Sucursal del empleado:** texto con ícono, sin selector.
- **Celular:** el menú lateral pasa a barra inferior; sucursal, tema y Salir van al menú de la cabecera; Administración usa un select con grupos.

## 0. Marco común

| Código | Diseño | Dónde |
| --- | --- | --- |
| Menú Caja · Catálogo · Stock · Clientes · Administración [Admin] | Igual, activo con fondo y pastilla que se desliza | Barra lateral |
| Sucursal (administradora) con «Todas las sucursales (consulta)» | Igual | Barra lateral, Select |
| Sucursal (empleado), sólo el nombre | Igual | Barra lateral |
| Botón de tema | «Tema: …» | Barra lateral, Ingresar |
| Salir | Igual | Barra lateral |
| Título · Conectado / Sin conexión · N operaciones pendientes · rol | Igual | Cabecera |
| Esqueletos, lista vacía, error, guardado, «Guardando…», × | Igual | Estados comunes, Botón |

## 1. Ingreso

Título «Todo el local, claro y en orden.» · Correo electrónico · Contraseña · Ingresar · botón de tema. Todo igual, en Ingresar.

## 2. Caja

| Código | Dónde |
| --- | --- |
| A · ¿Qué caja es este equipo? · Caja · Usar esta caja | Caja · elegir caja y abrir turno |
| B · Abrir turno en {caja} · Efectivo en la caja al empezar · Abrir turno · Este equipo es otra caja | Caja · elegir caja y abrir turno |
| C · Cerrar turno | Caja, barra del turno |
| Código o nombre + Agregar | Caja |
| Resultados (nombre · presentación · precio o $/kg) | Diálogos de caja |
| «Elegí la presentación» | Diálogos de caja |
| Vaciar · − / cantidad / + / × | Caja, ticket |
| Total · Efectivo / Transferencia / QR / Fiado | Caja, panel de cobro |
| Cliente del fiado · resultados · Cambiar cliente | Caja y Diálogos de caja |
| Cobrar $X | Caja (barra fija en celular) |
| Peso de {producto}: Peso leído en la balanza (g) · Cancelar · Agregar $X | Diálogos de caja, Modal |
| Cierre de caja: Medio de pago / Ventas / Total · Seguir vendiendo · Cerrar turno · Listo | Diálogos de caja |

## 3. Catálogo

Buscador · Marca · Rubro · Etiqueta · Limpiar filtros · Exportar Excel · tarjeta expandible con «desde $X», marca, rubro, etiquetas, presentaciones con precio de la sucursal y Avisar que falta (deshabilitado con «Todas las sucursales», con la razón escrita). Todo en Catálogo y Carta.

## 4. Stock y reposición

| Código | Dónde |
| --- | --- |
| Ingreso rápido: código + Buscar («Buscando…») | Stock, Diálogos de stock |
| Cantidad a ingresar · Vencimiento fabricante (opcional) · Ingresar lote · Cancelar | Stock |
| «No se encontró ningún producto activo con el código…» · «Elegí en qué sucursal entra la mercadería…» | Diálogos de stock |
| Actualizar · Buscar producto o proveedor · Estado del lote · Vencimiento · Ordenar por | Stock |
| Tabla: Producto / Presentación (+ proveedor, + sucursal) · Stock actual / inicial · Ingreso · Vencimiento · Apertura · Acciones | Stock, Tabla |
| Insignias Cerrado y Pendiente de sincronización | Stock, Estado |
| Abrir bolsa (deshabilitado «Ya hay una bolsa abierta») · Fraccionar · Ajustar · Traspasar [Admin] | Stock y «Más acciones» en Diálogos de stock |
| Traspasos: Cuándo · Producto · Cantidad · Desde → Hacia · Quién · Nota | Stock |
| Ajuste de stock (tipo, dirección, Cantidad, Motivo, Cancelar, Confirmar movimiento) | Diálogos de stock |
| Traspasar [Admin] (Sucursal de destino, Cantidad, Nota, Cancelar, Confirmar traspaso) | Diálogos de stock |
| Fraccionamiento (Presentación destino, bolsitas, ¿abierta o terminada?, cantidad real, Cancelar, Confirmar fraccionamiento) | Diálogos de stock |

El mensaje «(RF-12)» del deshabilitado se muestra sin el código interno: «Ya hay una bolsa abierta».

## 5. Clientes

Buscar · Nuevo cliente · Exportar · tarjeta con nombre, teléfono o «Sin teléfono», Archivado, Supera el tope, Saldo, Ver cuenta: en Clientes y Carta. Nuevo cliente (Nombre, Teléfono, Tope de fiado [Admin], Crear cliente, aviso de conexión) y Cuenta (Saldo, Tope, Teléfono, Abono / Fiado / Ajuste [Admin], Baja / Sube la deuda, Monto, Nota, Guardar…, Tope de fiado + Guardar tope [Admin], Últimos movimientos): en Diálogos de clientes.

## 6. Administración

| Pestaña del código | Grupo · sección | Dónde |
| --- | --- | --- |
| 1 Reportes | Ventas · Reportes | Administración · Reportes; Anular en Diálogos de administración |
| Panel de Márgenes (sin pestaña hoy) | Ventas · Márgenes | Administración · Márgenes |
| 2 Lotes (FEFO) | Mercadería · Lotes y vencimientos | Administración · Mercadería |
| 3 Fraccionamiento y granel | Mercadería · Fraccionamiento y granel | Administración · Mercadería |
| 4 Faltantes e ingresos | Mercadería · Faltantes e ingresos | Administración · Mercadería |
| 8 Proveedores | Mercadería · Proveedores | Administración · Mercadería |
| 6 Productos | Productos y precios · Productos | Administración · Productos; Cambiar precio en Diálogos de administración |
| 7 Precios sugeridos | Productos y precios · Precios sugeridos | Administración · Precios |
| 5 Marcas / Rubros / Etiquetas | Productos y precios · Marcas, rubros y etiquetas | Administración · Precios; Unir con… y su confirmación en Diálogos de administración |
| 10 Balanza | Productos y precios · Balanza | Administración · Precios; «Sí, convertir» en Diálogos de administración |
| 11 Sucursales y cajas | Negocio · Sucursales y cajas | Administración · Negocio y sistema |
| 12 Trazabilidad | Negocio · Trazabilidad | Administración · Negocio y sistema |
| 9 Códigos y planilla | Sistema · Códigos y planilla | Administración · Negocio y sistema |
| 13 Configuración y respaldos | Sistema · Configuración y respaldos | Administración · Negocio y sistema |

Todas las acciones de cada pestaña están en su sección, con los mismos nombres; las subpestañas (Lotes y fraccionamiento / Vida útil; Marcas / Rubros / Etiquetas; Planilla de mostrador / Probar lector / Generación de códigos) se conservan como pestañas.

## 7. Repeticiones resueltas

- **Ingreso rápido** vive en Stock. En Faltantes e ingresos queda un botón «Ingreso rápido» que lleva ahí: la acción sigue a mano y hay un solo formulario que mantener.
- **Tabla de lotes y traspasos** viven en Stock. En Lotes y vencimientos queda la Revisión de stock negativo y un botón «Ir a Stock y reposición». En Fraccionamiento y granel, la subpestaña «Lotes y fraccionamiento» es la misma tabla filtrada a granel.
- **Anular** pide confirmación: «¿Anular la venta C1-1288?», con la advertencia «Anular una venta no se puede deshacer.», Cancelar y Anular venta en peligro relleno.

## Sugerencias aparte

Para decidir; el diseño ya las aplica donde se indica.

- **«Fundación técnica»:** sacarla. Es texto para desarrolladores y no ayuda a operar el local. *No aparece en el diseño.*
- **«Acceso protegido»:** dejarla como una línea al pie de Configuración y respaldos («sólo administración entra a esta sección»), no como tarjeta.
- **Probar lector · Simular escaneo:** son herramientas de puesta a punto. Quedan en Sistema, pero se podrían mover a un modo técnico.
- **Navegación de Administración:** 14 secciones en cinco grupos. Si alguna se usa poco (Códigos y planilla, Balanza), se podrían fusionar más adelante; hoy se conserva todo.

## Lo que se sacó de los prototipos

No estaba en el código, así que no está en el diseño: contadores de lotes en Stock, KPIs de ventas en Reportes, saldo y tope del cliente en la caja, el ojo para ver la contraseña, la cantidad de resultados del catálogo, fotos de producto, atajos de teclado, métricas de eficiencia o latencia.

## RNF-04

Costos, márgenes y multiplicadores aparecen sólo en Administración (Márgenes, Productos, Precios sugeridos), que el empleado no ve. Caja, Catálogo, Stock y Clientes no los muestran en ningún tema ni estado.


---

<!-- tokens -->

# Tokens (CSS compilado)

```css
@font-face{font-family:'Manrope';src:url('fonts/manrope-latin-wght-normal.woff2') format('woff2');font-weight:200 800;font-style:normal;font-display:swap}

@font-face{font-family:'Plus Jakarta Sans';src:url('fonts/plus-jakarta-sans-latin-wght-normal.woff2') format('woff2');font-weight:200 800;font-style:normal;font-display:swap}

@font-face{font-family:'JetBrains Mono';src:url('fonts/jetbrains-mono-latin-wght-normal.woff2') format('woff2');font-weight:100 800;font-style:normal;font-display:swap}

:root,[data-theme="botanical"]{--color-fondo:#f1f3ed;--color-tinta:#1b2318;--color-tinta-suave:#465042;--color-tinta-apagada:#5f6a5a;--color-acento:#2c6620;--color-acento-tinta:#f7faf3;--color-exito:#0e6472;--color-aviso:#7f5c00;--color-error:#b4234a;--color-error-fuerte:#8e1b3a;--color-linea:#dde2d6;--color-hover:#1b23180d;--glass-fondo:#fbfcf9e6;--glass-borde:#1b231817;--carta-fondo:#fbfcf9;--carta-borde:#dfe4d8;--input-fondo:#ffffff;--input-borde:#7f8977;--foco-anillo:#2c6620;--boton-secundario-fondo:#e7ebe2;--glass-sombra:0 1px 0 #1b23180d, 0 8px 24px -12px #1b231829;--carta-sombra:0 1px 2px #1b23180f;--carta-hover-sombra:0 2px 4px #1b23180f, 0 8px 20px -6px #1b231824;--boton-sombra:0 1px 2px #1b231829;}

[data-theme="midnight"]{--color-fondo:#111511;--color-tinta:#d6dccf;--color-tinta-suave:#a9b1a2;--color-tinta-apagada:#8b9485;--color-acento:#a8cc80;--color-acento-tinta:#142011;--color-exito:#86d2c8;--color-aviso:#e0b45a;--color-error:#e97a89;--color-error-fuerte:#f4b0ba;--color-linea:#283028;--color-hover:#ffffff0d;--glass-fondo:#181d18e6;--glass-borde:#ffffff17;--carta-fondo:#181d18;--carta-borde:#262d26;--input-fondo:#0d110d;--input-borde:#656f61;--foco-anillo:#a8cc80;--boton-secundario-fondo:#232a23;--glass-sombra:0 1px 0 #0000004d, 0 8px 24px -12px #000000b3;--carta-sombra:0 1px 2px #00000040;--carta-hover-sombra:0 2px 4px #00000040, 0 8px 20px -6px #00000080;--boton-sombra:0 1px 2px #00000059;}

:root{--esp-xs:4px;--esp-s:8px;--esp-m:16px;--esp-l:24px;--esp-xl:32px;--radio-control:8px;--radio-boton:8px;--radio-carta:12px;--texto-xs:12px;--texto-s:14px;--texto-m:16px;--texto-l:20px;--texto-titulo:24px;--texto-cifra:48px;--fuente:Manrope, Segoe UI, system-ui, sans-serif;--fuente-titulos:Plus Jakarta Sans, Manrope, Segoe UI, system-ui, sans-serif;--fuente-datos:JetBrains Mono, Consolas, ui-monospace, monospace;--glass-blur:12px;--mov-rapido:150ms;--mov-normal:220ms;--mov-curva:cubic-bezier(0.2, 0, 0, 1);--font-texto:Manrope, "Segoe UI", system-ui, sans-serif;--font-titulos:"Plus Jakarta Sans", Manrope, "Segoe UI", system-ui, sans-serif;--font-datos:"JetBrains Mono", Consolas, ui-monospace, monospace;}
```


---

# Componentes

## Botón

Dice lo que pasa al tocarlo. Cuatro variantes y una sola primaria por pantalla.

**Marcado:** `<button class="boton boton--primario">Ingresar</button>`. Variantes `boton--primario`, `boton--secundario`, `boton--fantasma`, `boton--peligro`. Tamaños `boton--grande` (sólo Cobrar, 64 px), `boton--compacto` (36 px con área de 44), `boton--icono` (cuadrado, con `aria-label`), `boton--bloque` (ancho completo).

- **Primario** (`color-acento` con `color-acento-tinta`): la acción que cierra la tarea. Cobrar, Ingresar, Ingresar lote, Nuevo cliente, Guardar producto, Confirmar N cambios.
- **Secundario** (`boton-secundario-fondo`): acciones frecuentes que no son el objetivo: Exportar Excel, Agregar, Ver cuenta, Fraccionar.
- **Fantasma**: Cancelar, Limpiar filtros, Vaciar, Avisar que falta, Seguir vendiendo.
- **Peligro**: contorno y texto en `color-error`. Archivar, Quitar balanza. Para lo que no se puede deshacer (Anular venta) se suma `boton--confirmar`, que lo rellena con `color-error-fuerte`, y siempre va dentro de un diálogo de confirmación.
- **Ocupado:** `disabled aria-busy="true"` muestra «Guardando…» con un punto que late; no cambia de ancho.
- **Deshabilitado** con motivo visible al lado o en `title` (Abrir bolsa: «Ya hay una bolsa abierta»).
- Texto en tipo oración, 16 px 600. Ícono a la izquierda, 20 px (16 en compacto). Cifras dentro del botón en `boton__cifra` (JetBrains Mono).

## Campo

Etiqueta arriba, entrada de 44 px, ayuda o error abajo.

**Marcado:** `.campo` > `label.campo__etiqueta` + `.entrada` (con `input`, ícono opcional y `.entrada__sufijo`) + `p.campo__ayuda`. Error: `.campo--error` y `aria-invalid` en el input.

- `entrada--cifra` alinea a la derecha y usa JetBrains Mono: importes, pesos, porcentajes, días, multiplicadores. Sufijo para la unidad (`g`, `kg`, `%`, `días`).
- Placeholders cortos que caben en celular: «Código o nombre», «Nombre o teléfono».
- Escáner: el campo de código tiene foco automático y el ícono `barcode_scanner`; el lector escribe y manda Enter.
- Errores en `color-error` con ícono y una frase que dice cómo seguir: «El motivo es obligatorio.»
- Foco: borde y anillo de 2 px en `foco-anillo`.

## Select

Un `select` nativo con flecha propia, 44 px. Se usa cuando hay más de cuatro opciones o cuando la lista crece con los datos.

**Marcado:** `.selector` > `label.selector__prefijo` (texto o ícono) + `select` + ícono `keyboard_arrow_down`.

- **Sucursal:** sólo la administradora ve el selector, con «Todas las sucursales (consulta)» como última opción. El empleado ve el nombre de su sucursal como texto (`.sucursal-fija`).
- En barras de filtro el rótulo va adentro como prefijo («Marca Todas», «Rubro Frutos secos») para ahorrar una línea.
- Marca y Rubro del catálogo son select y no chips: crecen con los datos y una fila de 20 chips no entra.
- Administración en celular: un select con `optgroup` por grupo reemplaza a la navegación secundaria.

## Chip de filtro

Botón que se prende y se apaga para filtrar por etiqueta. Se usa sólo para Etiqueta en Catálogo.

**Marcado:** `<button class="chip" aria-pressed="true">Sin TACC</button>` dentro de `.chips role="group"`.

- «Todas» va primero y quita el filtro del eje; elegir otra etiqueta la apaga.
- Elegido: fondo de acento al 14 %, borde de acento y tilde. No depende sólo del color.
- 36 px de alto con área táctil de 44 (`::after`). En celular la fila se desliza (`chips--deslizable`).
- Marca y Rubro, que en el código también eran chips, pasan a select (ver Select).

## Opciones

Radios con forma de mosaico o de segmento, para elegir una cosa entre pocas a la vista.

**Marcado:** `.opciones role="radiogroup"` > `label.opcion` > `input[type=radio]` + ícono + texto (+ tilde). Variantes `opciones--segmento`, `opciones--tres`, `opciones--lista`.

- **Medio de pago:** Efectivo · Transferencia · QR · Fiado, mosaicos de 56 px con tilde en la elegida.
- **Segmento:** rango de Reportes (7 · 30 · 90 días), movimiento de cuenta (Abono · Fiado · Ajuste), sentido del ajuste, Aplicar a (Todo · Marca · Rubro · Proveedor).
- **Lista:** motivos del ajuste de stock y «¿queda abierta o se terminó?» del fraccionamiento.
- El estado elegido no depende del color: tilde o fondo de carta con sombra en el segmento.

## Estado

Insignia de una o pocas palabras; siempre ícono y palabra.

**Marcado:** `<span class="estado estado--aviso"><span class="ic ic-warning"></span>Crítico · 3 días</span>`.

- **Vencimiento del lote**, con los mismos cuatro valores del filtro: `estado--exito` «En regla» → `estado--neutro` «Por vencer · 18 días» → `estado--aviso` «Crítico · 3 días» → `estado--critico` «Vencido» (relleno `color-error-fuerte`, el único sólido).
- **Lote:** «Cerrado» (neutro, candado) y «Pendiente de sincronización» (aviso, `sync`).
- **Cliente:** «Supera el tope» (error) y «Archivado» (neutro).
- **Caja:** «Turno abierto» (éxito). **Rol:** «Administrador» / «Empleado» (neutro, en la cabecera).
- `estado--etiqueta` (contorno) para atributos del producto: «Sin TACC», «Vegano».
- 12 px 600, tipo oración. Fondo = color del estado al 14 % sobre `carta-fondo`.

## Carta

Superficie para un objeto: un producto, un cliente, el panel de cobro, una tabla. No para envolver cualquier cosa.

**Marcado:** `.carta` (relleno 24 px, radio 12, borde y sombra mínima). `carta--sin-relleno` cuando contiene una tabla, con `.carta__cabecera`. `carta--interactiva` cuando toda la carta responde al puntero.

- **Producto** (`details.carta.producto`): cerrada muestra nombre, «desde $X», marca · rubro y etiquetas. Abierta suma las presentaciones con el precio de la sucursal y «Avisar que falta» (deshabilitado con «Todas las sucursales», con la razón escrita).
- **Cliente:** nombre, teléfono o «Sin teléfono», insignias «Supera el tope» y «Archivado», saldo y Ver cuenta.
- Sin fotos de producto: el catálogo se reconoce por nombre, marca y precio.

## KPI

Franja de resumen: celdas separadas por línea dentro de una sola superficie, arriba del detalle que resumen.

**Marcado:** `.kpis` > `.kpi` (`.kpi__etiqueta` con ícono opcional, `.kpi__valor`, `.kpi__nota`).

- Se usa sólo donde el código ya calcula esos números: el resumen de «Revisá antes de confirmar» (Subas, Bajas, Total de cambios) y la cuenta del cliente (Saldo, Tope, Teléfono).
- No se agregan contadores que la app no tiene. Reportes no lleva franja: sus números están en los gráficos.
- Valor en JetBrains Mono 24 px, etiqueta 14 px `color-tinta-suave`.
- En celular la franja se vuelve lista: etiqueta a la izquierda, valor a la derecha.

## Tabla

Para datos que se comparan por columna. Encabezado de 12 px en mayúsculas espaciadas, filas de 52 px (44 en `tabla--compacta`).

**Marcado:** `.tabla-marco` > `table.tabla`; `th.num`/`td.num` para cifras alineadas a la derecha en JetBrains Mono; `td.acciones` para la última columna.

- **Lotes:** Producto / Presentación (+ proveedor, + sucursal con «Todas») · Stock actual / inicial con medidor · Ingreso · Vencimiento con estado · Apertura · Acciones. En acciones va visible la que corresponde (Fraccionar si hay bolsa abierta de granel, Abrir bolsa si no, Ajustar si no aplica ninguna) y el resto en el menú «Más acciones»: Abrir bolsa, Fraccionar, Ajustar, Traspasar (sólo administradora y con más de una sucursal).
- **Vista previa de precios:** Producto · Presentación · Precio actual · Precio nuevo · Variación.
- Hover con `color-hover`; fila elegida con `aria-selected`.
- En celular la tabla se vuelve `lista`: título, meta y estado a la izquierda, cifra o menú a la derecha.

## Modal

Diálogo centrado sobre un velo; en celular sube como hoja desde abajo. Es una de las dos superficies con desenfoque.

**Marcado:** `.velo` > `.modal role="dialog" aria-modal="true" aria-labelledby` > `.modal__cabecera` (título, bajada, cerrar ×) + `.modal__cuerpo` + `.modal__pie`.

- El título dice qué se hace y sobre qué: «Peso de Nuez mariposa extra blanca», «Ajuste de stock: …», «Cuenta de Marta Rossi».
- La acción del pie lleva el resultado: «Agregar $6.660», «Confirmar 24 cambios», «Guardar abono».
- **Confirmaciones** para lo que no se puede deshacer o cambia muchos datos: Anular venta, Unir con…, «Sí, convertir» a balanza. Pregunta en el título, consecuencia en un mensaje de error, Cancelar fantasma y la acción en peligro relleno.
- Entra en `mov-normal` con fundido y 8 px de subida; con movimiento reducido, sólo fundido.
- En celular el pie se apila: la acción arriba, a ancho completo.
- Todos los diálogos de la app están en Diálogos de caja, stock, clientes y administración.

## Barra lateral

`app-sidebar`, 240 px. No se mueve entre páginas: es el ancla de la transición.

- Marca «alverde», sucursal, menú, y al pie el botón de tema y Salir.
- **Sucursal:** la administradora tiene un select con «Todas las sucursales (consulta)»; el empleado ve el nombre como texto.
- **Menú:** Caja · Catálogo · Stock · Clientes · Administración (sólo administradora). El ítem activo tiene fondo de acento al 14 % y una pastilla (`nav__indicador`) que se desliza al cambiar de página.
- **Tema:** «Tema: Botanical» / «Tema: Midnight» (antes «Diseño: …»).
- **Celular:** el menú pasa a una barra inferior de cinco ítems («Admin» como nombre corto); sucursal, tema y Salir van al menú de la cabecera.

## Cabecera

`app-header`: título de la página, estado de conexión y rol. Pegajosa, de vidrio (la otra superficie con desenfoque).

- **Conexión:** «Conectado» (`conexion--ok`), «Conectado · N operaciones pendientes» (`conexion--pendiente`) o «Sin conexión · N operaciones pendientes» (`conexion--sin`). Ícono distinto en cada caso. En celular se acorta: «2 pendientes», «Sin conexión · 3».
- **Rol:** insignia neutra «Administrador» o «Empleado».
- El título hace fundido al cambiar de página (`app-titulo`).
- En celular el rol se oculta y aparece el botón de menú con sucursal, tema y Salir.

## Navegación secundaria

Las 13 pestañas de Administración, más Márgenes, ordenadas en cinco grupos.

- **Ventas:** Reportes · Márgenes.
- **Mercadería:** Lotes y vencimientos · Fraccionamiento y granel · Faltantes e ingresos · Proveedores.
- **Productos y precios:** Productos · Precios sugeridos · Marcas, rubros y etiquetas · Balanza.
- **Negocio:** Sucursales y cajas · Trazabilidad.
- **Sistema:** Códigos y planilla · Configuración y respaldos.

Columna de 224 px a la izquierda del contenido; el grupo en 12 px mayúsculas, la sección en 14 px con ícono. En celular se reemplaza por un select con `optgroup`.

## Iconografía

Material Symbols Outlined 400, el set que ya usa la app, copiado como máscaras CSS en `bundle.css`: funciona sin conexión y toma el color del texto.

**Marcado:** `<span class="ic ic-barcode_scanner" aria-hidden="true"></span>`. Tamaños `ic--s` 16, por defecto 20, `ic--l` 24.

- Siempre al lado de una palabra, salvo en botones de ícono, que llevan `aria-label` (Cerrar, Quitar del ticket, Más acciones, Menú).
- Un ícono por concepto en toda la app: `barcode_scanner` para escanear, `scale` para balanza, `call_split` para fraccionar, `swap_horiz` para traspasar, `sync` para pendiente.

## Estados comunes

- **Cargando:** esqueletos con un pulso lento de opacidad; es la única animación continua y se apaga con movimiento reducido.
- **Lista vacía:** ícono, una frase en negrita y qué va a aparecer ahí.
- **Error** en rojo con ícono, **guardado** con tilde, **«Guardando…»** deshabilitado, y cerrar con ×.


---

# Pantallas y diálogos

## Ingresar · escritorio

1366 × 768, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- «Todo el local, claro y en orden.» como título; Correo electrónico, Contraseña e Ingresar (primaria, a ancho completo).
- El botón de tema queda abajo, para que se elija antes de entrar.
- Sin ojo para mostrar la contraseña ni «olvidé mi contraseña»: no están en el código.

## Ingresar · celular

390 × 844, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- «Todo el local, claro y en orden.» como título; Correo electrónico, Contraseña e Ingresar (primaria, a ancho completo).
- El botón de tema queda abajo, para que se elija antes de entrar.
- Sin ojo para mostrar la contraseña ni «olvidé mi contraseña»: no están en el código.

## Caja · elegir caja y abrir turno · escritorio

1366 × 768, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- **A · Elegir caja** (marco Botanical): «¿Qué caja es este equipo?», select Caja y Usar esta caja.
- **B · Abrir turno** (marco Midnight): «Abrir turno en Caja 1», Efectivo en la caja al empezar, Abrir turno y, como fantasma, Este equipo es otra caja.
- Una sola carta centrada; la barra lateral y la cabecera siguen en su lugar para que la transición a vender sea sólo el contenido.

## Caja · elegir caja y abrir turno · celular

390 × 844, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- **A · Elegir caja** (marco Botanical): «¿Qué caja es este equipo?», select Caja y Usar esta caja.
- **B · Abrir turno** (marco Midnight): «Abrir turno en Caja 1», Efectivo en la caja al empezar, Abrir turno y, como fantasma, Este equipo es otra caja.
- Una sola carta centrada; la barra lateral y la cabecera siguen en su lugar para que la transición a vender sea sólo el contenido.

## Caja · vendiendo · escritorio

1366 × 768, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- Ticket a la izquierda y cobro a la derecha: el TOTAL y Cobrar siempre a la vista y legibles a 1 m.
- Arriba, el turno en una línea: Turno abierto, caja, hora, efectivo inicial y Cerrar turno (secundario).
- Código o nombre + Agregar. Los resultados muestran nombre · presentación · precio o $/kg; si hay varias presentaciones aparece «Elegí la presentación» (ver Diálogos de caja).
- Ticket con Vaciar y, por línea, − / cantidad / + y × (quitar).
- Total en 48 px, `color-tinta`. Medio de pago Efectivo / Transferencia / QR / Fiado. Con Fiado aparece Cliente del fiado y Cambiar cliente.
- Cobrar $X es la única primaria. En celular el total y Cobrar quedan en una barra fija sobre la navegación.

## Caja · vendiendo · celular

390 × 844, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- Ticket a la izquierda y cobro a la derecha: el TOTAL y Cobrar siempre a la vista y legibles a 1 m.
- Arriba, el turno en una línea: Turno abierto, caja, hora, efectivo inicial y Cerrar turno (secundario).
- Código o nombre + Agregar. Los resultados muestran nombre · presentación · precio o $/kg; si hay varias presentaciones aparece «Elegí la presentación» (ver Diálogos de caja).
- Ticket con Vaciar y, por línea, − / cantidad / + y × (quitar).
- Total en 48 px, `color-tinta`. Medio de pago Efectivo / Transferencia / QR / Fiado. Con Fiado aparece Cliente del fiado y Cambiar cliente.
- Cobrar $X es la única primaria. En celular el total y Cobrar quedan en una barra fija sobre la navegación.

## Diálogos de caja

- **Resultados de búsqueda** bajo el campo: nombre · presentación · precio o $/kg.
- **Elegí la presentación** cuando el producto tiene varias.
- **Cliente del fiado:** buscador con resultados (nombre y teléfono o «Sin teléfono»).
- **Peso de {producto}:** Peso leído en la balanza (g), Cancelar y Agregar $X con el importe calculado.
- **Cierre de caja:** tabla Medio de pago / Ventas / Total; Seguir vendiendo y Cerrar turno. Ya cerrado: «Turno cerrado.» y Listo.

## Catálogo · escritorio

1366 × 768, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- Buscador, Marca y Rubro como select con «Todas» / «Todos», Exportar Excel.
- Etiqueta como chips, con «Todas» primero; Limpiar filtros a la derecha.
- Cartas expandibles: «desde $X», marca · rubro, etiquetas; abiertas, las presentaciones con el precio de la sucursal y Avisar que falta (deshabilitado con «Todas las sucursales»).
- No tiene acción primaria: la tarea es buscar. Ningún costo ni margen.

## Catálogo · celular

390 × 844, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- Buscador, Marca y Rubro como select con «Todas» / «Todos», Exportar Excel.
- Etiqueta como chips, con «Todas» primero; Limpiar filtros a la derecha.
- Cartas expandibles: «desde $X», marca · rubro, etiquetas; abiertas, las presentaciones con el precio de la sucursal y Avisar que falta (deshabilitado con «Todas las sucursales»).
- No tiene acción primaria: la tarea es buscar. Ningún costo ni margen.

## Stock y reposición · escritorio

1366 × 768, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- **Ingreso rápido:** código + Buscar («Buscando…»); con el producto encontrado, Cantidad a ingresar, Vencimiento fabricante (opcional), Cancelar e Ingresar lote (la primaria de la pantalla). Errores en Diálogos de stock.
- **Control de stock y lotes:** Actualizar; filtros Buscar, Estado del lote, Vencimiento y Ordenar por («Vence primero» reemplaza a «Cercanía de vencimiento (FEFO)»).
- Tabla con insignias Cerrado y Pendiente de sincronización; la acción que corresponde visible y el resto en «Más acciones».
- **Traspasos entre sucursales:** Cuándo · Producto · Cantidad · Desde → hacia · Quién · Nota.
- El ejemplo es de una administradora sin conexión, con tres operaciones pendientes.

## Stock y reposición · celular

390 × 844, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- **Ingreso rápido:** código + Buscar («Buscando…»); con el producto encontrado, Cantidad a ingresar, Vencimiento fabricante (opcional), Cancelar e Ingresar lote (la primaria de la pantalla). Errores en Diálogos de stock.
- **Control de stock y lotes:** Actualizar; filtros Buscar, Estado del lote, Vencimiento y Ordenar por («Vence primero» reemplaza a «Cercanía de vencimiento (FEFO)»).
- Tabla con insignias Cerrado y Pendiente de sincronización; la acción que corresponde visible y el resto en «Más acciones».
- **Traspasos entre sucursales:** Cuándo · Producto · Cantidad · Desde → hacia · Quién · Nota.
- El ejemplo es de una administradora sin conexión, con tres operaciones pendientes.

## Diálogos de stock

- Errores del ingreso rápido: «No se encontró ningún producto activo con el código…» y «Elegí en qué sucursal entra la mercadería…» (cuando la administradora está en «Todas»). Estado «Buscando…».
- **Más acciones** del lote: Abrir bolsa (deshabilitado con «Ya hay una bolsa abierta»), Fraccionar (sólo granel), Ajustar, Traspasar (sólo administradora, con más de una sucursal).
- **Ajuste de stock:** Merma / Desperdicio, Descarte por vencimiento, Ajuste de inventario; Agregar faltante / Descontar sobrante; Cantidad; Motivo obligatorio; Confirmar movimiento.
- **Traspasar:** Sucursal de destino, Cantidad, Nota (opcional), Confirmar traspaso.
- **Fraccionamiento:** Presentación destino, Cantidad de bolsitas, ¿queda abierta o se terminó?, Cantidad real que quedó, Confirmar fraccionamiento.

## Clientes · escritorio

1366 × 768, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- Buscar por nombre o teléfono, Exportar y Nuevo cliente (primaria; «Nuevo» en celular).
- Cartas con nombre, teléfono o «Sin teléfono», Supera el tope y Archivado, saldo y Ver cuenta.
- Nuevo cliente y la cuenta están en Diálogos de clientes.

## Clientes · celular

390 × 844, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- Buscar por nombre o teléfono, Exportar y Nuevo cliente (primaria; «Nuevo» en celular).
- Cartas con nombre, teléfono o «Sin teléfono», Supera el tope y Archivado, saldo y Ver cuenta.
- Nuevo cliente y la cuenta están en Diálogos de clientes.

## Diálogos de clientes

- **Nuevo cliente:** Nombre, Teléfono (opcional), Tope (opcional, sólo administradora), Crear cliente. Sin conexión se avisa que necesita conexión y el botón queda deshabilitado.
- **Cuenta:** Saldo, Tope y Teléfono arriba; Movimiento Abono / Fiado / Ajuste (Ajuste sólo administradora) y, si es Ajuste, Baja la deuda / Sube la deuda; Monto, Nota y Guardar abono / fiado / ajuste.
- Tope y Guardar tope, sólo administradora.
- Últimos movimientos: Fecha · Tipo · quién · Nota · Importe.

## Administración · Reportes · escritorio

1366 × 768, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- Navegación secundaria con cinco grupos a la izquierda (select en celular).
- Reportes: rango 7 / 30 / 90 días; Ventas diarias (el día en curso rayado), Top 10, Demanda por rubro, Demanda por etiqueta; Últimas 50 ventas con Anular, que ahora pide confirmación.
- El resto de las secciones está en Administración · Márgenes, Mercadería, Productos, Precios y Negocio y sistema.

## Administración · Reportes · celular

390 × 844, en los dos temas: Botanical Living y Midnight Bio Precision. La estructura es la misma; cambian sólo los tokens.

- Navegación secundaria con cinco grupos a la izquierda (select en celular).
- Reportes: rango 7 / 30 / 90 días; Ventas diarias (el día en curso rayado), Top 10, Demanda por rubro, Demanda por etiqueta; Últimas 50 ventas con Anular, que ahora pide confirmación.
- El resto de las secciones está en Administración · Márgenes, Mercadería, Productos, Precios y Negocio y sistema.

## Administración · Márgenes

Panel de márgenes (RF-26), sólo administradora: Producto · Presentación · Último costo · Precio de venta · Ganancia bruta · Margen bruto (%), de menor a mayor margen.

Es la única pantalla, junto con Productos y Precios sugeridos, donde aparecen costos y multiplicadores. Ninguna pantalla del empleado los muestra (RNF-04).

## Administración · Mercadería

- **Lotes y vencimientos** (antes «Lotes (FEFO)»): Revisión de stock negativo con Qué se hizo, Marcar como revisado y Ver resueltos. La tabla de lotes y los traspasos no se repiten: un enlace lleva a Stock y reposición.
- **Fraccionamiento y granel:** subpestañas Lotes y fraccionamiento (Stock filtrado a granel) y Vida útil (masivo): buscar, casillas, Días tras apertura, Aplicar a N seleccionados, Limpiar (N/A).
- **Faltantes e ingresos:** lista de reposición por proveedor con Marcar resuelto; Ingreso rápido lleva al de Stock.
- **Proveedores:** Nombre, Contacto, Crear proveedor / Actualizar, Cancelar; tabla con Editar.

## Administración · Productos

- Nuevo producto.
- **Ficha:** Nombre, Código de barras, Marca, Rubro, Unidad base, Multiplicador propio, Guardar producto (primaria) y Archivar.
- **Presentaciones:** Nombre, Cantidad base, Precio, Añadir; por fila, Cambiar precio base abre «Cambiar precio».
- **Costo y precio sugerido:** Proveedor, Costo total del envase, Contenido, Código del proveedor, Proveedor principal, Registrar costo / Actualizar costo y fecha de compra; tabla con Editar; sugerencias con Aplicar sugerido.
- **Precio por sucursal** con Guardar precios por sucursal (vacío = usa el base) e **Historial de precios**: Cuándo · Quién · Anterior · Nuevo · Variación.

## Administración · Precios, marcas y balanza

- **Precios sugeridos:** multiplicador general con Guardar valor general y uno por rubro con Guardar; actualización masiva (Aplicar a, Precios de, Porcentaje, Redondear a $100, Ver qué cambiaría); «Revisá antes de confirmar» con Subas, Bajas y Total, la tabla, Confirmar N cambios y Cancelar; Para reetiquetar con Exportar a Excel.
- **Marcas, rubros y etiquetas:** subpestañas; Agregar nuevo (Nombre, Rubro padre, Crear); por ítem Renombrar, Asignar a productos (casillas, Marcar los N visibles, Desmarcar, Asignar a N, Quitar de los marcados), Unir con… y Archivar.
- **Balanza:** Buscar, Precio por kilo, Marcar balanza / Guardar precio / Quitar balanza; la confirmación «Sí, convertir» está en Diálogos de administración.

## Administración · Negocio y sistema

- **Sucursales y cajas:** Nueva sucursal con Dirección y Crear sucursal; por sucursal, cajas con Archivar / Reactivar y Nueva caja con Agregar caja; Personal: Persona · Rol · Sucursal.
- **Trazabilidad:** texto, Persona, Tipo, Desde, Hasta, Buscar y Limpiar; tabla Cuándo · Quién · Qué · Campo · Antes · Después.
- **Códigos y planilla:** Imprimir planilla; Probar lector (O ingreso manual, Simular escaneo, Último resultado); Autogenerar códigos faltantes (granel).
- **Configuración y respaldos:** Elegir carpeta para la segunda copia, Recuperar desde un respaldo…, Descargar copia completa y los nueve exportes CSV. «Acceso protegido» queda en una línea; «Fundación técnica» se propone sacar (ver Inventario).

## Diálogos de administración

- **Anular venta:** confirmación nueva, porque no se puede deshacer. Cancelar y Anular venta en peligro relleno.
- **Cambiar precio:** Precio nuevo y Guardar precio.
- **Unir con…:** select, Cancelar y Unir; después, la confirmación con los dos nombres.
- **Balanza:** «Sí, convertir» antes de pasar un producto a venta por peso.
