/**
 * Alverde · selección de diseño (tema visual)
 * -------------------------------------------
 * Dos sistemas de diseño conviven y se eligen desde la barra superior:
 *   · "alverde-botanical" → Alverde Botanical Living (claro, glassmorfismo botánico;
 *     continuación del RNF-06 original). Es el predeterminado.
 *   · "midnight-bio"      → Midnight Bio Precision (oscuro, denso, consola de laboratorio).
 *
 * El tema es solo presentación: no viaja a Supabase ni cambia datos ni permisos.
 * Se guarda en localStorage y se aplica como `data-theme` en <html>.
 *
 * IMPORTANTE: cada *.html de la raíz tiene un script inline en el <head> que aplica
 * el tema antes de que cargue el CSS (evita el parpadeo del tema equivocado). Ese
 * script repite THEME_STORAGE_KEY, los ids y THEME_COLORS a mano, porque corre antes
 * que cualquier módulo. `themeHeadScript.test.ts` verifica que no se desincronicen.
 */

export const THEMES = ["alverde-botanical", "midnight-bio"] as const;
export type ThemeId = (typeof THEMES)[number];

export const DEFAULT_THEME: ThemeId = "alverde-botanical";
export const THEME_STORAGE_KEY = "alverde-tema";

/** Nombre visible de cada diseño, para el botón del selector. */
export const THEME_LABELS: Record<ThemeId, string> = {
  "alverde-botanical": "Botanical",
  "midnight-bio": "Midnight"
};

/** Color de la barra del navegador / ventana PWA (<meta name="theme-color">). */
export const THEME_COLORS: Record<ThemeId, string> = {
  "alverde-botanical": "#f9faf6",
  "midnight-bio": "#101410"
};

/** Normaliza lo leído de localStorage: cualquier valor desconocido o corrupto cae al predeterminado. */
export function parseTheme(value: unknown): ThemeId {
  return THEMES.includes(value as ThemeId) ? (value as ThemeId) : DEFAULT_THEME;
}

/** Con dos temas, el selector alterna; con más, recorre la lista en orden. */
export function nextTheme(current: ThemeId): ThemeId {
  return THEMES[(THEMES.indexOf(current) + 1) % THEMES.length] as ThemeId;
}

/** Tema activo según el atributo que dejó el script inline del <head>. */
export function currentTheme(root: Pick<HTMLElement, "getAttribute"> = document.documentElement): ThemeId {
  return parseTheme(root.getAttribute("data-theme"));
}

/** Aplica el tema al documento (atributo + color de la barra del navegador). */
export function applyTheme(theme: ThemeId, doc: Document = document): void {
  doc.documentElement.setAttribute("data-theme", theme);
  doc.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

/** Lee la elección guardada. Si el almacenamiento no está disponible (modo privado estricto), usa el predeterminado. */
export function readStoredTheme(storage: Pick<Storage, "getItem"> = localStorage): ThemeId {
  try {
    return parseTheme(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

/** Guarda la elección. Un fallo al guardar no impide cambiar el tema en la sesión actual. */
export function storeTheme(theme: ThemeId, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* sin almacenamiento: el tema vale solo hasta recargar */
  }
}
