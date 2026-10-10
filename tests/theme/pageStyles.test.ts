import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Las hojas por página (RNF-06) tienen que verse bien con los dos temas. Eso solo se
 * cumple si no fija colores propios y si cada variable que usa existe en ambos
 * temas (o en tokens.css). Si alguien agrega un `#fff` o un `var(--x)` que un
 * tema no define, esta prueba falla.
 */
const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const definedVars = (css: string) =>
  new Set([...stripComments(css).matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]));

const usedVars = (css: string) =>
  new Set([...stripComments(css).matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)].map((m) => m[1]));

const PAGE_SHEETS = ["src/styles/pos.css", "src/styles/catalog.css", "src/styles/stock.css", "src/styles/customers.css", "src/styles/admin.css"];

describe.each(PAGE_SHEETS)("%s con los dos temas", (sheet) => {
  const pos = stripComments(read(sheet));

  it("no fija colores sueltos (hex, rgb, hsl, nombres)", () => {
    const literal = pos.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|color-mix)\(|\b(?:white|black|red|green|blue|gray|grey)\b(?!-)/g);
    expect(literal, `colores sueltos en ${sheet}: ${literal?.join(", ")}`).toBeNull();
  });

  it("cada variable que usa está definida en ambos temas, en tokens.css o en la propia hoja", () => {
    const botanical = definedVars(read("src/styles/themes/alverde-botanical.css"));
    const midnight = definedVars(read("src/styles/themes/midnight-bio.css"));
    const tokens = definedVars(read("src/styles/tokens.css"));
    const local = definedVars(pos);

    const missing = [...usedVars(pos)].filter(
      (v) => !local.has(v) && !tokens.has(v) && !(botanical.has(v) && midnight.has(v))
    );
    expect(missing, `variables sin definir en algún tema: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("Caja: el TOTAL no compite con Cobrar", () => {
  // Decisión del sistema de diseño: el total va en la tinta principal y en 48 px (se lee a 1 m);
  // el acento queda sólo para Cobrar, la acción principal.
  const design = stripComments(read("src/styles/design-system.css"));
  const pos = stripComments(read("src/styles/pos.css"));

  it("el total usa la cifra de 48 px y la tinta principal, no el acento", () => {
    expect(design).toMatch(/\.total__cifra\s*\{[^}]*var\(--texto-cifra\)[^}]*color:\s*var\(--color-tinta\)/);
    expect(read("src/styles/tokens.css")).toMatch(/--texto-cifra:\s*48px/);
  });

  it("la hoja de la caja no le pone acento ni fondo al total", () => {
    expect(pos).not.toMatch(/\.total[^{]*\{[^}]*--color-acento/);
    expect(pos).not.toMatch(/pos-total-box/);
  });
});
