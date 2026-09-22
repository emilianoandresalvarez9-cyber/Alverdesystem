# DISEÑO — Sistema de diseño Alverde (Agente D · RNF-06 a RNF-09)

> Guía de uso para los agentes A, B y C. Leé esto antes de escribir cualquier estilo o componente.

## Regla única

**No inventés valores.** Si necesitás un color, radio, espacio o duración, usá una variable de `tokens.css`. Si no existe, agregála ahí y documentála en este archivo.

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
<Button variant="primary">Guardar</Button>
<Button variant="secondary">Cancelar</Button>
<Button variant="ghost">Más opciones</Button>
```

### `GlassCard`
```tsx
<GlassCard>Contenido</GlassCard>
<GlassCard padding="compact">Tarjeta pequeña</GlassCard>
```

### `TextField`
```tsx
<TextField label="Nombre" value={val} onChange={setVal} />
<TextField label="Buscar" error="Campo requerido" />
```

### `SelectField`
```tsx
<SelectField label="Marca" value={val} onChange={setVal} options={[
  { value: "1", label: "Del local" }
]} />
```

### `Badge`
```tsx
<Badge tone="success">Activo</Badge>
<Badge tone="warning">Offline</Badge>
<Badge tone="error">Error</Badge>
<Badge tone="neutral">Inactivo</Badge>
```

### `Tag`
```tsx
<Tag onRemove={() => removeTag(id)}>Vegano</Tag>
<Tag>Sin TACC</Tag>
```

### `EmptyState`
```tsx
<EmptyState icon="📦" title="Sin productos" description="Agregá el primero." />
```

### `Modal`
```tsx
<Modal open={open} onClose={() => setOpen(false)} title="Nuevo producto">
  <Button onClick={() => setOpen(false)}>Cerrar</Button>
</Modal>
```

## Modo sin-blur (hardware modesto)

La notebook Celeron/Atom de la caja puede tener lag con `backdrop-filter`:
```html
<html class="sin-blur">
```
Las superficies glass pasan a fondo opaco sin perder el aspecto general.

## View Transitions entre páginas

Activas en `global.css`:
```css
@view-transition { navigation: auto; }
```
Funciona automáticamente en Edge/Chrome al navegar entre las 3 páginas HTML.

## Pendiente de verificar en hardware real

- [ ] `backdrop-filter` sin lag en notebook Celeron/Atom de la caja (Edge, Windows 10)
- [ ] View Transitions fluidas en ese hardware
- [ ] Si hay lag: activar `sin-blur` y documentar qué página lo necesita
