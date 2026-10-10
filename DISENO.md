# DISEÑO — Sistema de diseño Alverde (RNF-06 a RNF-09)

> Leé esto antes de escribir cualquier estilo o componente. La fuente de verdad es el paquete de
> Claude Design: [`docs/diseno/sistema-de-diseno.md`](docs/diseno/sistema-de-diseno.md) (reglas,
> decisiones, tokens, componentes, pantallas e inventario de acciones).

## Reglas

- **No inventés valores.** Todo color, tamaño, espacio, radio o duración sale de un token:
  `src/styles/tokens.css` (lo que no cambia con el tema) y `src/styles/themes/*.css` (colores,
  superficies y sombras, con los mismos nombres en los dos temas).
- **Un solo acento por pantalla:** `--color-acento` es la acción principal y el estado activo.
  Nunca para totales, títulos ni gráficos.
- **Vidrio sólo en la cabecera y el modal.** Todo lo demás es opaco (`.carta`).
- **Ningún estado sólo por color:** ícono y palabra en estados, tilde en chips y opciones.
- **Lo que no se deshace pide confirmación** en un diálogo (Anular venta, Unir con…, convertir a balanza).
- Español rioplatense con voseo, tipo oración, sin emojis ni códigos internos (RF-xx, FEFO) en pantalla.
- **RNF-04:** el empleado nunca ve costos, márgenes ni multiplicadores.

## Temas

El paquete los llama `botanical` y `midnight`; en el código son `data-theme="alverde-botanical"`
(predeterminado, también en `:root`) y `data-theme="midnight-bio"`. Se conservaron los nombres del
código para no perder el tema que eligió cada equipo (`localStorage["alverde-tema"]`).

## Hojas

| Archivo | Qué tiene |
|---|---|
| `src/styles/global.css` | Importa fuentes, tokens, temas y el sistema. Al final, el **puente** para el marcado de páginas que todavía no pasaron al sistema. |
| `src/styles/design-system.css` | Generado del `bundle.css` del paquete (secciones 1–18 y 20) + adaptaciones a React (sección 21). Clases en español: `boton`, `campo`, `entrada`, `selector`, `chip`, `estado`, `carta`, `kpis`, `tabla`, `lista`, `modal`, `opciones`, `nav-sec`, shell `app-sidebar` / `app-header` / `app-content`. |
| `src/styles/pos.css`, `catalog.css`… | Hojas por página, sólo con tokens (`tests/theme/pageStyles.test.ts`). |

## Componentes (`src/shared/ui/`)

```tsx
import { Button, GlassCard, TextField, SelectField, Badge, Tag, EmptyState, Modal, Icon, Options, Message } from "../shared/ui";

<Button>Cobrar</Button>                                  // primario: una sola por pantalla
<Button variant="secundario" icon="download">Exportar</Button>
<Button variant="fantasma">Cancelar</Button>
<Button variant="peligro">Archivar</Button>
<Button variant="peligro" confirmar>Anular venta</Button> // relleno: sólo dentro de su confirmación
<Button size="grande" block>Cobrar $17.120</Button>      // sólo Cobrar

<GlassCard>…</GlassCard>                                 // .carta (opaca, pese al nombre)
<GlassCard padding="none">tabla con cabecera</GlassCard>

<TextField label="Peso" suffix="g" numeric />           // etiqueta arriba, ayuda o error abajo
<TextField label="Código" icon="barcode_scanner" autoFocus />
<SelectField label="Caja">…</SelectField>

<Badge tone="aviso">Crítico · 3 días</Badge>              // aviso/error/exito/critico traen ícono
<Badge tone="neutro" icon="lock">Cerrado</Badge>
<Tag active>Sin TACC</Tag>                               // chip con aria-pressed y tilde
<Options name="medio" legend="Medio de pago" value={m} onChange={setM}
  options={[{ value: "cash", label: "Efectivo", icon: "payments" }]} />   // variant: mosaico | segmento | lista | tres
<Message tone="exito">Guardado.</Message>               // error → role="alert"
<EmptyState title="Todavía no hay clientes">Creá el primero con Nuevo cliente.</EmptyState>
<Modal open title="Peso de Nuez mariposa" onClose={…} footer={…}>…</Modal>   // wide para tablas
<Icon name="scale" />                                    // Material Symbols como máscara, sin red
```

## Transiciones entre páginas (RNF-07/RNF-08)

- `@view-transition { navigation: auto; }` y los nombres de bloque están en `design-system.css`
  (secciones 17 y 18): la barra lateral queda quieta, la pastilla del ítem activo se desliza y
  sólo el título y el contenido cambian. Con movimiento reducido, sólo un fundido.
- Para que la página nueva tenga el marco en su **primer cuadro**: el script de cada página lleva
  `blocking="render"` (plugin en `vite.config.ts`), cada entrada monta con `mountPage()` (render
  síncrono) y `AuthGate` dibuja con el último perfil verificado mientras verifica la sesión.
  `tests/theme/viewTransition.test.tsx` y `appShell.test.tsx` lo cubren.
