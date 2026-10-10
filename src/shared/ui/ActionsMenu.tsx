import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";

export type MenuAction = {
  label: string;
  icon: IconName;
  onSelect: () => void;
  disabled?: boolean;
  /** Por qué está deshabilitada; se escribe debajo de la opción. */
  reason?: string;
};

/**
 * «Más acciones» de una fila (Ajustar, Traspasar…). Es un botón que despliega una lista de
 * botones (patrón disclosure): Escape o tocar afuera la cierra y el foco vuelve al botón.
 * Se posiciona fijo respecto del botón para que una tabla con scroll no lo recorte, y lo sigue al desplazar.
 */
export function ActionsMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = (focusTrigger: boolean) => {
    setOpen(false);
    setPosition(null);
    if (focusTrigger) trigger.current?.focus();
  };

  const place = () => {
    if (!trigger.current || !panel.current) return;
    const rect = trigger.current.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return close(false);
    const height = panel.current.offsetHeight;
    const below = rect.bottom + 4;
    const top = below + height > window.innerHeight && rect.top - height - 4 > 0 ? rect.top - height - 4 : below;
    setPosition({ top, right: Math.max(8, window.innerWidth - rect.right) });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  // Foco en la primera opción recién cuando el menú ya está en su lugar, y sin desplazar la
  // página: un desplazamiento lo cerraría.
  useEffect(() => {
    if (open && position) panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(true); };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) close(false);
    };
    // Al desplazar la página el menú acompaña al botón (y se cierra si el botón sale de la vista).
    const onScroll = (event: Event) => { if (!panel.current?.contains(event.target as Node)) place(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  if (actions.length === 0) return null;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="boton boton--fantasma boton--icono"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <Icon name="more_horiz" />
      </button>
      {open ? (
        <div
          ref={panel}
          id={panelId}
          className="menu menu--flotante"
          aria-label={label}
          role="group"
          style={position ? { top: position.top, right: position.right } : { top: 0, right: 0, visibility: "hidden" }}
        >
          {actions.map((action) => (
            <div key={action.label} className="menu__opcion">
              <button type="button" disabled={action.disabled} onClick={() => { close(false); action.onSelect(); }}>
                <Icon name={action.icon} />
                {action.label}
              </button>
              {action.disabled && action.reason ? <p className="menu__motivo">{action.reason}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
