# Revisión técnica para Antigravity

Repositorio: `emilianoandresalvarez9-cyber/Alverdesystem`
Pull Request: [#2](https://github.com/emilianoandresalvarez9-cyber/Alverdesystem/pull/2)

## Objetivo

Revisar y corregir los errores del sistema de diseño del PR #2 sin cambiar la arquitectura general del proyecto. La revisión debe centrarse en:

- `src/shared/ui/`
- `src/styles/`
- `demo/index.html`
- `DISENO.md`
- La estructura real del proyecto y la configuración de Vite/TypeScript

No fusiones cambios directamente en `main` sin verificar primero el build y el tipado.

## Problemas detectados

### 1. La documentación no coincide con la API real

`DISENO.md` utiliza nombres de props que no existen en los componentes actuales.

La implementación usa:

- `Button`: `primario`, `secundario`, `fantasma`, `peligro`
- `Badge`: `neutro`, `exito`, `aviso`, `error`
- `SelectField`: recibe elementos `<option>` como `children`, no una prop `options`
- `EmptyState`: recibe `title`, `action` y contenido como `children`; no recibe `icon` ni `description`

Actualizar `DISENO.md` para que sus ejemplos compilen realmente. Alternativamente, si se prefiere una API en inglés, cambiar los tipos y componentes, pero mantener una sola convención en todo el proyecto.

Ejemplos correctos:

```tsx
<Button variant="primario">Guardar</Button>
<Button variant="secundario">Cancelar</Button>
<Button variant="fantasma">Más opciones</Button>

<Badge tone="exito">Activo</Badge>
<Badge tone="aviso">Offline</Badge>
<Badge tone="error">Error</Badge>
<Badge tone="neutro">Inactivo</Badge>

<SelectField label="Marca" value={value} onChange={handleChange}>
  <option value="1">Del local</option>
</SelectField>

<EmptyState title="Sin productos" action={<Button>Agregar producto</Button>}>
  Agregá el primero.
</EmptyState>
```

### 2. Orden de props en `Button.tsx`

En `src/shared/ui/Button.tsx`, el componente calcula `type` y después expande `rest`. Evitar que una prop expandida pueda sobrescribir valores controlados.

Usar este patrón:

```tsx
export function Button({
  variant = "primario",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [classByVariant[variant], className].filter(Boolean).join(" ");

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {children}
    </button>
  );
}
```

Verificar que un botón dentro de un formulario no haga submit por defecto y que `type="submit"` siga funcionando cuando se solicita explícitamente.

### 3. Orden de props y accesibilidad en `Tag.tsx`

En `src/shared/ui/Tag.tsx`, `aria-pressed` debe ser controlado por `active` y no quedar sobrescribible por `rest`.

Usar este patrón:

```tsx
export function Tag({
  active = false,
  className,
  children,
  type = "button",
  ...rest
}: TagProps) {
  const classes = ["tag", active ? "tag-activo" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      type={type}
      aria-pressed={active}
      className={classes}
    >
      {children}
    </button>
  );
}
```

### 4. Accesibilidad del `Modal`

En `src/shared/ui/Modal.tsx`, asociar el título al elemento `<dialog>` mediante `aria-labelledby`.

Usar `useId()` para evitar colisiones si existen varios modales:

```tsx
import { useEffect, useId, useRef } from "react";

const titleId = useId();

<dialog
  ref={ref}
  className="modal glass"
  aria-labelledby={titleId}
  onClose={onClose}
>
  <div className="modal-head">
    <h2 id={titleId}>{title}</h2>
    {/* ... */}
  </div>
</dialog>
```

Verificar también el comportamiento con el botón de cierre, la tecla Escape y el callback `onClose`.

### 5. Modo `sin-blur`

En `src/styles/tokens.css` se configura `--glass-blur: 0px`, pero `global.css` continúa aplicando `backdrop-filter`. Para hardware modesto, desactivar explícitamente el filtro:

```css
.glass {
  -webkit-backdrop-filter: blur(var(--glass-blur));
  backdrop-filter: blur(var(--glass-blur));
}

html.sin-blur .glass {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
```

Comprobar que el modo `sin-blur` mantiene una superficie opaca legible y no genera lag innecesario.

### 6. Compatibilidad CSS

Evaluar fallbacks para navegadores antiguos de Windows 10 que puedan no soportar `color-mix()` o `backdrop-filter`.

Agregar valores fallback antes de los valores modernos cuando sea necesario. Por ejemplo:

```css
.glass {
  background: rgba(244, 255, 240, 0.13);
  background: var(--glass-fondo);
}
```

No sacrificar la legibilidad si el navegador no soporta las funciones modernas.

### 7. Verificar duplicación de fuentes

El repositorio contiene archivos del sistema de diseño en rutas como:

- `src/shared/ui/`
- `src/styles/`
- `Cluade fases/alverde-fase1-agente-d/kit/src/shared/ui/`
- `Cluade fases/alverde-fase1-agente-d/kit/src/styles/`

Determinar cuál es la fuente usada realmente por Vite. Debe existir una única fuente de verdad para los componentes que consume la aplicación. Si la carpeta `Cluade fases/.../kit` es material de exportación, dejarlo documentado o excluirlo del build para evitar editar un archivo mientras se compila otro.

## Verificación requerida

Ejecutar en una rama de trabajo:

```bash
npm ci
npx tsc --noEmit
npm run build
npm run lint
```

Si alguno de esos scripts no existe, informar cuál falta y ejecutar las alternativas disponibles.

Probar manualmente:

1. Todos los ejemplos de `DISENO.md`.
2. Botones dentro y fuera de formularios.
3. Tags con teclado y `aria-pressed`.
4. Modal con apertura, cierre y Escape.
5. `<html class="sin-blur">` en Edge sobre hardware modesto.
6. `demo/index.html`.
7. Responsive a 320 px, 768 px y escritorio.

## Criterios de aceptación

- `DISENO.md` coincide con la API real y sus ejemplos compilan.
- TypeScript no presenta errores.
- El build de producción termina correctamente.
- No hay duplicación ambigua de componentes o estilos.
- El modal tiene nombre accesible.
- `Button` y `Tag` mantienen controladas sus props semánticas.
- El modo `sin-blur` elimina realmente el desenfoque.
- No se introducen secretos, costos o márgenes en el frontend de empleados.
- Crear un commit descriptivo y explicar cualquier cambio adicional.

## Entrega esperada

Antes de cerrar la tarea, informar:

- Archivos modificados.
- Errores corregidos.
- Comandos de QA ejecutados y resultado.
- Limitaciones o problemas que no pudieron verificarse.
- Hash del commit final.
