/**
 * Marca del sitio público: un brote de dos hojas saliendo de la tierra. Dibujo propio, plano y
 * de dos tonos; los colores salen de la paleta del sitio (storefront.css).
 */
export function SproutMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg className={["brote", className].filter(Boolean).join(" ")} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path className="brote__tierra" d="M10 58c3-11 12-16 22-16s19 5 22 16z" />
      <path className="brote__tallo" d="M32 46c-.6-7 .4-13 .4-19" fill="none" strokeWidth="4" strokeLinecap="round" />
      <path className="brote__hoja brote__hoja--menor" d="M32.4 29C24 29 14 24 11 13c12-1.5 20.5 5 21.4 16z" />
      <path className="brote__hoja brote__hoja--mayor" d="M32.4 27C32.4 14 42 6 56 5c0 13-9 22-23.6 22z" />
    </svg>
  );
}
