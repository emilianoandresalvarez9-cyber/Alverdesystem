import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";

/**
 * Monta la página de forma síncrona. Junto con `<script type="module" blocking="render">`
 * (vite.config.ts), el primer cuadro de la página nueva ya tiene el marco, y la transición
 * entre páginas (RNF-08) desliza la pastilla del menú y funde sólo el título y el contenido.
 */
export function mountPage(node: ReactNode, container: HTMLElement = document.getElementById("root")!): void {
  const root = createRoot(container);
  flushSync(() => root.render(node));
}
