# DISEÑO.md — Sistema de diseño de Alverde (Agente D)

**Cubre:** RNF-06 (glassmorfismo elegante), RNF-07 (transiciones animadas),
RNF-08 (MPA + View Transitions), RNF-09 (modularidad).
**Leer antes de construir cualquier pantalla de Fase 1 en adelante.**

## Qué contiene este kit

| Archivo | Qué es |
|---|---|
| `src/styles/tokens.css` | Tokens de diseño: colores, radios, espaciado, tipografía, movimiento. Única fuente de estos valores. |
| `src/styles/global.css` | Hoja global: reemplaza a la de Fase 0 **manteniendo todas sus clases** y suma los componentes de base (botones, campos, badges, tags, tablas, toolbar, estado vacío, esqueleto, modal). |
| `src/shared/ui/*.tsx` | Componentes React tipados: `Button`, `GlassCard`, `TextField`, `SelectField`, `Badge`, `Tag`, `EmptyState`, `Modal`. Se importan desde `src/shared/ui` (barrel `index.ts`). |
| `demo/index.html` | Muestrario estático: abrilo en el navegador para ver todos los componentes juntos. No forma parte del build. |

## Cómo integrarlo al repo

1. En una rama `agente-d-diseno`: copiar `src/styles/tokens.css` (nuevo),
   reemplazar `src/styles/global.css` y agregar la carpeta `src/shared/ui/`.
2. Verificar que las páginas existentes (login, catálogo, administración) se ven
   igual o mejor — las clases de Fase 0 se mantienen a propósito.
3. `npm run typecheck && npm test && npm run build`.
4. QA real (regla de la sección 12): probar en la notebook de la caja con Edge.
   Si alguna pantalla se siente lenta, ver "Presupuesto de rendimiento" abajo.
5. PR hacia `main` y avisar en `TAREAS.md` que el sistema de diseño está
   disponible, para que los agentes A, B y C construyan sobre él.

## Reglas para los demás agentes (A, B, C y siguientes)

- **No inventar estilos.** Colores, radios, sombras y espaciados salen de
  `tokens.css`. Si falta un token, se agrega ahí y se anota acá — nunca un
  valor suelto dentro de un componente.
- **No escribir CSS nuevo si ya existe una clase.** Antes de agregar CSS,
  revisar `global.css`: botones, campos, tablas, tags, badges, toolbar,
  estados vacíos y modales ya están resueltos.
- **Importar componentes desde `src/shared/ui`**, no re-implementarlos.
- **Formularios:** siempre `TextField` / `SelectField` (garantizan etiqueta,
  ayuda y error accesibles). Errores de envío: clase `form-error`.
- **Ningún dato de costos o márgenes en la UI de Empleado** (RNF-04): el
  sistema de diseño no lo impide por sí solo — es responsabilidad de cada
  pantalla no pedir ni mostrar esos campos.
- **Táctil:** los controles ya cumplen el mínimo de 44 px de alto con su
  padding; no reducirlo.

## Presupuesto de rendimiento (la notebook Celeron/Atom de la caja)

El desenfoque (`backdrop-filter`) es lo más caro de pintar en ese hardware:

- Máximo **una o dos superficies `.glass` con blur por pantalla** (la barra
  superior y una tarjeta protagonista, por ejemplo).
- Todo elemento **repetido** (filas de listado, grilla de productos) usa
  `.glass-lite` o el componente `<GlassCard lite>`: mismo lenguaje visual,
  sin blur.
- Si una página igual se siente lenta en la notebook real, agregar la clase
  `sin-blur` al `<html>` de esa página: el glass pasa a fondo opaco
  equivalente en todo el documento.
- Las animaciones respetan `prefers-reduced-motion` automáticamente
  (definido en `tokens.css`).

## Transiciones entre páginas (RNF-07/RNF-08)

`@view-transition { navigation: auto; }` ya está activo en `global.css` y
aplica a todo documento que la importe. Toda página nueva del MPA debe
importar `global.css` (que a su vez importa `tokens.css`) y nada más: con eso
las transiciones funcionan solas en Edge/Chrome 126+. No agregar librerías de
animación para cambios de página.

## Uso rápido de los componentes

```tsx
import { Badge, Button, EmptyState, GlassCard, Modal, SelectField, Tag, TextField } from "../shared/ui";

// Acción principal y secundaria
<Button onClick={guardar} loading={guardando}>Guardar</Button>
<Button variant="secundario" onClick={cancelar}>Cancelar</Button>

// Tarjeta repetida en un listado (sin blur, barata)
<GlassCard lite>…</GlassCard>

// Campo con ayuda y con error
<TextField label="Nombre del producto" help="Como figura en la etiqueta" />
<TextField label="Precio" error="Tiene que ser un número" />

// Filtros combinables del catálogo (RF-04)
<Tag active={filtros.has("vegano")} onClick={() => alternar("vegano")}>Vegano</Tag>

// Estados de stock / sincronización
<Badge tone="exito">Sincronizado</Badge>
<Badge tone="aviso">3 pendientes</Badge>

// Listado sin resultados
<EmptyState title="Sin resultados" action={<Button variant="secundario">Limpiar filtros</Button>}>
  Probá con menos filtros o revisá la ortografía.
</EmptyState>

// Confirmaciones
<Modal open={abierto} title="Archivar producto" onClose={cerrar}
  footer={<><Button variant="secundario" onClick={cerrar}>Cancelar</Button>
           <Button variant="peligro" onClick={archivar}>Archivar</Button></>}>
  El producto no se borra: queda archivado y conserva su historial (RF-56).
</Modal>
```

## Clases CSS disponibles sin componente

`glass`, `glass-lite`, `card`, `card-flush`, `toolbar`, `tag-row`,
`table-wrap` (envolver toda tabla para el scroll horizontal en celulares),
`empty-state`, `skeleton`, `notice`, `form-error`, `field-help`,
`field-error`, `badge badge-exito|aviso|error`, `visualmente-oculto`,
y las heredadas de Fase 0 (`app-shell`, `topbar`, `page-heading`,
`dashboard-grid`, `feature-card`, `sync-status`, `loading-card`, …).

## Pendiente / decisiones abiertas

- Toasts de confirmación: por ahora usar `notice` dentro de la pantalla;
  si Fase 3 (caja) necesita avisos flotantes, se agregan acá primero.
- Gráficos (RF-61 a RF-64, Fase 4): cuando toque, la librería debe tomar los
  colores desde los tokens (`--color-acento`, `--color-dorado`, `--color-verde-medio`).
