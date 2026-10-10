import { useEffect, useState } from "react";

/** El mismo corte que el sistema de diseño (consulta de contenedor a 720 px sobre <body>). */
export const COMPACT_QUERY = "(max-width: 720px)";

/**
 * true en celular. Para las pocas piezas que cambian de marcado (el ticket de la caja pasa de
 * tabla a lista, el cobro va a una barra fija) y no sólo de estilo: así no hay dos copias del
 * mismo botón en la página.
 */
export function useCompact(): boolean {
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.(COMPACT_QUERY).matches));
  useEffect(() => {
    const query = window.matchMedia?.(COMPACT_QUERY);
    if (!query) return;
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return compact;
}
