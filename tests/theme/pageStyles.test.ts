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

const PAGE_SHEETS = ["src/styles/pos.css", "src/styles/catalog.css", "src/styles/stock.css"];

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

describe("Caja: el total por tema", () => {
  const pos = stripComments(read("src/styles/pos.css"));

  it("el panel del total cambia de aspecto por tema a través de variables, no de colores", () => {
    // El bloque del total es lo único de la caja que se ve distinto entre temas:
    // verde lleno en botanical, negro con lima en midnight. Tiene que resolverse
    // con un selector por data-theme y variables locales, sin tocar los temas.
    expect(pos).toMatch(/\[data-theme="midnight-bio"\]\s+\.pos-total-box\s*\{[^}]*--pos-total-fondo:/);
    expect(pos).toMatch(/\.pos-total-box\s*\{[^}]*--pos-total-fondo:\s*var\(--color-acento\)/);
  });
});
