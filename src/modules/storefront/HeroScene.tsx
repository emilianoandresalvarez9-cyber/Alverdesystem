/**
 * Escena de la portada: el brote de la marca crece y a su lado flotan un jugo de naranja y una
 * barra de cereal. Son ilustraciones genéricas y decorativas (sin marcas ni precios): los
 * productos reales, con su precio, están en la lista que viene de la base.
 * Todo el movimiento es CSS (storefront.css) y se apaga con «reducir movimiento».
 */
export function HeroScene() {
  return (
    <svg className="escena" viewBox="0 0 520 420" role="img" aria-label="Un brote que crece entre una botella de jugo de naranja y una barra de cereal">
      <defs>
        <clipPath id="escena-botella">
          <path d="M80 172c0-14 12-22 12-22h26s12 8 12 22v146c0 10-8 16-18 16H98c-10 0-18-6-18-16z" />
        </clipPath>
        <clipPath id="escena-barra">
          <rect x="372" y="212" width="128" height="52" rx="9" />
        </clipPath>
      </defs>

      {/* Hojitas y gajo que acompañan */}
      <g className="escena__entra escena__entra--4">
        <g className="escena__flota escena__flota--lenta">
          <path className="escena__hojita" d="M432 96c14-16 34-18 48-10-8 16-28 22-48 10z" />
        </g>
      </g>
      <g className="escena__entra escena__entra--5">
        <g className="escena__flota escena__flota--media">
          <path className="escena__hojita escena__hojita--clara" d="M52 82c4-14 16-22 30-20 0 14-12 24-30 20z" />
        </g>
      </g>
      <g className="escena__entra escena__entra--5">
        <g className="escena__gira">
          <circle className="escena__gajo" cx="404" cy="338" r="24" />
          <circle className="escena__gajo-pulpa" cx="404" cy="338" r="18" />
          <path className="escena__gajo-linea" d="M404 320v36M386 338h36M391.3 325.3l25.4 25.4M416.7 325.3l-25.4 25.4" fill="none" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>

      {/* Brote de la marca */}
      <path className="escena__tierra" d="M150 380c22-58 198-58 220 0z" />
      <path className="escena__tallo" d="M260 344c-3-40 2-78 2-114" fill="none" strokeWidth="12" strokeLinecap="round" pathLength={1} />
      <g className="escena__hoja escena__hoja--menor">
        <path className="escena__hoja-forma" d="M262 234c-34 0-72-18-86-58 46-8 82 16 86 58z" />
        <path className="escena__nervio" d="M256 228c-22-10-44-24-66-44" fill="none" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g className="escena__hoja escena__hoja--mayor">
        <path className="escena__hoja-forma escena__hoja-forma--clara" d="M262 226c0-48 40-84 96-88 0 50-36 88-96 88z" />
        <path className="escena__nervio" d="M268 220c26-22 52-46 78-70" fill="none" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Jugo de naranja */}
      <g className="escena__entra escena__entra--2">
        <g className="escena__flota escena__flota--botella">
          <rect className="escena__tapa" x="88" y="112" width="34" height="18" rx="5" />
          <rect className="escena__vidrio" x="92" y="130" width="26" height="22" />
          <path className="escena__vidrio" d="M80 172c0-14 12-22 12-22h26s12 8 12 22v146c0 10-8 16-18 16H98c-10 0-18-6-18-16z" />
          <g clipPath="url(#escena-botella)">
            <path className="escena__jugo" d="M20 192q15-9 30 0t30 0 30 0 30 0 30 0 30 0V340H20z" />
          </g>
          <rect className="escena__etiqueta" x="80" y="234" width="50" height="56" />
          <circle className="escena__gajo" cx="105" cy="262" r="15" />
          <circle className="escena__gajo-pulpa" cx="105" cy="262" r="11" />
          <path className="escena__gajo-linea" d="M105 251v22M94 262h22" fill="none" strokeWidth="1.5" strokeLinecap="round" />
          <path className="escena__brillo" d="M88 176v120" fill="none" strokeWidth="4" strokeLinecap="round" />
        </g>
      </g>

      {/* Barra de cereal */}
      <g className="escena__entra escena__entra--3">
        <g className="escena__flota escena__flota--barra">
          <path className="escena__envoltorio" d="M360 216l8 6-8 6 8 6-8 6 8 6-8 6 8 6-8 6h12v-48zM512 216l-8 6 8 6-8 6 8 6-8 6 8 6-8 6 8 6h-12v-48z" />
          <rect className="escena__envoltorio" x="372" y="212" width="128" height="52" rx="9" />
          <rect className="escena__etiqueta" x="392" y="224" width="58" height="28" rx="6" />
          <path className="escena__hojita" d="M421 244c-8 0-13-4-15-11 8-1 14 3 15 11zM421 243c0-8 5-13 13-14 0 8-5 13-13 14z" />
          <g clipPath="url(#escena-barra)">
            <path className="escena__destello" d="M330 204h22l-26 68h-22z" />
          </g>
        </g>
      </g>
    </svg>
  );
}
