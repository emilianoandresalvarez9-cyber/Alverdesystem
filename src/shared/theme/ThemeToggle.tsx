import { useEffect, useState } from "react";
import {
  THEME_LABELS,
  THEME_STORAGE_KEY,
  applyTheme,
  currentTheme,
  nextTheme,
  parseTheme,
  storeTheme,
  type ThemeId
} from "./theme";

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

/**
 * Botón que alterna entre los dos diseños. El estado inicial se toma de <html data-theme>,
 * que ya fijó el script inline del <head>, así el botón nunca contradice lo que se ve.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeId>(() => currentTheme());
  const target = nextTheme(theme);

  // Otra pestaña cambió el tema: seguirla, para no tener la caja en un diseño y el stock en otro.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const incoming = parseTheme(event.newValue);
      applyTheme(incoming);
      setTheme(incoming);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const change = () => {
    const update = () => {
      applyTheme(target);
      setTheme(target);
    };
    storeTheme(target);
    const doc = document as ViewTransitionDocument;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (doc.startViewTransition && !reduceMotion) doc.startViewTransition(update);
    else update();
  };

  const label = `Diseño: ${THEME_LABELS[theme]}`;
  return (
    <button
      type="button"
      className="button button-secondary theme-toggle"
      onClick={change}
      aria-label={`${label}. Cambiar a ${THEME_LABELS[target]}`}
      title={`Cambiar a ${THEME_LABELS[target]}`}
    >
      <span aria-hidden="true" className="theme-toggle-dot" />
      {label}
    </button>
  );
}
