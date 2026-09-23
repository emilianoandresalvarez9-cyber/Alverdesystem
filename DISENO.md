# DISEÑO — Sistema de diseño Alverde (Agente D · RNF-06 a RNF-09)

> Guía de uso para los agentes A, B y C. Leé esto antes de escribir cualquier estilo o componente.

## Regla única

**No inventés valores.** Si necesitás un color, radio, espacio o duración, usá una variable de `tokens.css`. Si no existe, agregala ahí y documentala en este archivo.

## Tokens (`src/styles/tokens.css`)

| Variable | Valor | Uso |
|---|---|---|
| `--color-fondo` | `#10221a` | Fondo general |
| `--color-acento` | `#d5ef89` | Botón primario, foco, marca |
| `--color-acento-tinta` | `#11221b` | Texto sobre el acento |
| `--color-tinta` | `#eef8ed` | Texto principal |
| `--color-tinta-suave` | `#d8ead7` | Texto secundario |
| `--color-tinta-apagada` | `#afd8a5` | Texto terciario, estados de carga |
| `--color-error` | `#ffc1ba` | Mensajes de error |
| `--color-aviso` | `#ffc36c` | Advertencias, offline |
| `--color-exito` | `#b9e88b` | Confirmaciones |
| `--glass-blur` | `14px` | Blur para glassmorfismo |
| `--radio-control` | `.7rem` | Botones, inputs |
| `--radio-carta` | `1.25rem` | Tarjetas |
| `--radio-pastilla` | `999px` | Tags, badges |
| `--esp-xs/s/m/l/xl` | `.35–2.5rem` | Espaciado |
| `--mov-rapido` | `120ms` | Transiciones rápidas |
| `--mov-normal` | `220ms` | Transiciones normales |

## Componentes (`src/shared/ui/`)

```typescript
import { Button, GlassCard, TextField, SelectField, Badge, Tag, EmptyState, Modal } from "../shared/ui";
```

### `Button`
```tsx
<Button variant="primario">Guardar</Button>
<Button variant="secundario">Cancelar</Button>
<Button variant="fantasma">Más opciones</Button>
<Button variant="peligro">Eliminar</Button>
```

### `GlassCard`
```tsx
<GlassCard>Contenido</GlassCard>
<GlassCard padding="compact">Tarjeta compacta</GlassCard>
```

### `TextField`
```tsx
<TextField
  label="Nombre"
  value={val}
  onChange={(e) => setVal(e.target.value)}
  placeholder="Ej. Arcor"
/>
<TextField label="Buscar" error="Campo requerido" />
```

### `SelectField`
```tsx
<SelectField
  label="Marca"
  value={val}
  onChange={(e) => setVal(e.target.value)}
>
  <option value="">Seleccionar marca</option>
  <option value="1">Del local</option>
</SelectField>
```

### `Badge`
```tsx
<Badge tone="exito">Activo</Badge>
<Badge tone="aviso">Offline</Badge>
<Badge tone="error">Error</Badge>
<Badge tone="neutro">Inactivo</Badge>
```

### `Tag`
```tsx
<Tag active={isSelected} onClick={() => setIsSelected(!isSelected)}>
  Vegano
</Tag>
```

### `EmptyState`
```tsx
<EmptyState title="Sin productos" action={<Button variant="primario">Agregar producto</Button>}>
  Agregá el primero desde el formulario superior.
</EmptyState>
```

### `Modal`
```tsx
<Modal open={open} onClose={() => setOpen(false)} title="Nuevo producto">
  <p>Contenido del modal</p>
  <Button variant="secundario" onClick={() => setOpen(false)}>Cerrar</Button>
</Modal>
```

## Modo sin-blur (hardware modesto)

La notebook Celeron/Atom de la caja puede tener lag con `backdrop-filter`:
```html
<html class="sin-blur">
```
Las superficies `.glass` desactivan el desenfoque (`backdrop-filter: none`) y pasan a un fondo más opaco con excelente legibilidad y rendimiento fluido.

## View Transitions entre páginas

Activas en `global.css`:
```css
@view-transition { navigation: auto; }
```
Funciona automáticamente en Edge/Chrome al navegar entre las 3 páginas HTML.
