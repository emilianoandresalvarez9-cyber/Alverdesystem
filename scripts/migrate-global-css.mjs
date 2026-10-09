import { readFileSync, writeFileSync } from 'node:fs';

let css = readFileSync('src/styles/global.css', 'utf8');

css = css.replace('@import "./tokens.css";', '@import "./themes/alverde-botanical.css";\n@import "./themes/midnight-bio.css";');

css = css.replace(/body\s*{[^}]*background:[^;]*;\s*}/m, 'body {\n  min-width: 320px;\n  min-height: 100vh;\n  margin: 0;\n  background: var(--fondo-pagina);\n}');

css = css.replace(/\.glass\s*{[^}]*}/m, `.glass {
  background: var(--glass-fondo);
  border: 1px solid var(--glass-borde);
  box-shadow: var(--glass-sombra);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturacion));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturacion));
}`);

css = css.replace(/html\.sin-blur \.glass\s*{[^}]*}/m, `html.sin-blur .glass {
  background: var(--glass-fondo-opaco);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}`);

css = css.replace(/\.glass-lite\s*{[^}]*}/m, `.glass-lite {
  background: var(--glass-fondo-lite);
  border: 1px solid var(--glass-borde);
  box-shadow: none;
}`);

css = css.replace(/\.card\s*{[^}]*}/m, `.card {
  border-radius: var(--radio-carta);
  padding: var(--esp-l);
  background: var(--carta-fondo);
  border: 1px solid var(--carta-borde);
  box-shadow: var(--carta-sombra);
}`);

css = css.replace(/h1\s*{[^}]*}/m, `h1 {
  max-width: 13ch;
  margin: 0 0 1.75rem;
  font-family: var(--fuente-titulos);
  font-size: var(--texto-titulo);
  line-height: 1;
  letter-spacing: var(--titulo-tracking);
  font-weight: var(--titulo-peso);
}`);

css = css.replace(/h2\s*{[^}]*}/m, `h2 {
  margin: .4rem 0 .75rem;
  font-family: var(--fuente-titulos);
  font-size: var(--texto-l);
  letter-spacing: var(--titulo-tracking);
  font-weight: var(--titulo-peso);
}`);

css = css.replace(/^input, select, textarea\s*{[^}]*}/m, `input, select, textarea {
  width: 100%;
  border: 1px solid var(--input-borde);
  border-radius: var(--radio-control);
  padding: .8rem .9rem;
  color: var(--color-tinta);
  background: var(--input-fondo);
  box-shadow: var(--input-sombra);
  font-family: var(--fuente-datos);
  transition: border-color var(--mov-rapido) var(--mov-curva), box-shadow var(--mov-rapido) var(--mov-curva);
}`);

css = css.replace(/input:focus-visible, select:focus-visible, textarea:focus-visible\s*{[^}]*}/m, `input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: none;
  border-color: var(--color-acento);
  box-shadow: var(--foco-anillo);
}`);

css = css.replace(/\.button\s*{[^}]*}/m, `.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .5rem;
  border: 0;
  border-radius: var(--radio-boton);
  padding: .8rem 1rem;
  color: var(--color-acento-tinta);
  background: var(--color-acento);
  font-weight: 800;
  box-shadow: var(--boton-sombra);
  transition: filter var(--mov-rapido) var(--mov-curva), transform var(--mov-rapido) var(--mov-curva);
}`);

css = css.replace(/\.button-secondary\s*{[^}]*}/m, `.button-secondary {
  padding: .55rem .8rem;
  color: var(--boton-secundario-tinta);
  background: var(--boton-secundario-fondo);
  border: 1px solid var(--boton-secundario-borde);
  box-shadow: none;
}`);

css = css.replace(/\.button-ghost\s*{[^}]*}/m, `.button-ghost {
  padding: .55rem .8rem;
  color: var(--color-tinta-suave);
  background: transparent;
  box-shadow: none;
  border: 1px solid transparent;
}`);

css = css.replace(/\.button-danger\s*{[^}]*}/m, `.button-danger {
  color: var(--color-error-tinta);
  background: var(--color-error-fuerte);
  box-shadow: none;
}`);

css = css.replace(/\.badge-exito\s*{[^}]*}/m, `.badge-exito { color: var(--color-exito-tinta); background: var(--color-exito); }`);
css = css.replace(/\.badge-aviso\s*{[^}]*}/m, `.badge-aviso { color: var(--color-aviso-tinta); background: var(--color-aviso); }`);
css = css.replace(/\.badge-error\s*{[^}]*}/m, `.badge-error { color: var(--color-error-tinta); background: var(--color-error-fuerte); }`);
css = css.replace(/\.badge\s*{[^}]*}/m, `.badge {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  border-radius: var(--radio-pastilla);
  padding: .25rem .7rem;
  font-size: var(--texto-xs);
  font-weight: 750;
  color: var(--color-tinta-suave);
  background: var(--color-badge-fondo);
}`);


css = css.replace(/thead th\s*{[^}]*}/m, `thead th {
  position: sticky;
  top: 0;
  padding: .8rem .9rem;
  text-align: left;
  font-size: var(--texto-xs);
  font-weight: 750;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--tabla-cabecera-tinta);
  background: var(--tabla-cabecera-fondo);
}`);

css = css.replace(/tbody td\s*{[^}]*}/m, `tbody td {
  padding: .8rem .9rem;
  border-top: 1px solid var(--color-linea);
  font-family: var(--fuente-datos);
}`);

css = css.replace(/tbody tr:hover\s*{[^}]*}/m, `tbody tr:hover { background: var(--color-hover); }`);

css = css.replace(/dialog\.modal::backdrop\s*{[^}]*}/m, `dialog.modal::backdrop { background: var(--backdrop); }`);

writeFileSync('src/styles/global.css', css);
