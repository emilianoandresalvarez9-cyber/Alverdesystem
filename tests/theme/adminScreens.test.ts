import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Administración con el sistema de diseño (RNF-06): lo que se ve en pantalla no lleva códigos
 * de requisito, siglas internas ni emojis, no usa las clases del marcado anterior ni estilos
 * fijos en línea, y no confirma con los diálogos del navegador.
 */
const root = process.cwd();
const DIRS = ["src/modules/admin", "src/modules/audit", "src/modules/barcodes", "src/modules/fractioning"];

/** Sin comentarios: ahí sí van los RF, para quien lee el código. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");

const screens = DIRS.flatMap((dir) =>
  readdirSync(join(root, dir))
    .filter((name) => name.endsWith(".tsx") && !name.includes(".test."))
    .map((name) => ({ file: `${dir}/${name}`, code: stripComments(readFileSync(join(root, dir, name), "utf8")) }))
);

describe.each(screens)("$file", ({ file, code }) => {
  it("sin RF-, FEFO ni emojis en el texto", () => {
    expect(code.match(/RF-\d|FEFO|\p{Extended_Pictographic}/gu), file).toBeNull();
  });

  it("sin clases del marcado anterior", () => {
    const old = code.match(/className="[^"]*\b(?:pos-[a-z-]+|glass|field-help|notice|loading-card|dashboard-grid|table-wrap|form-error|page-heading)\b/g);
    expect(old, file).toBeNull();
  });

  it("sin estilos fijos en línea (sólo valores calculados)", () => {
    expect(code.match(/style=\{\{[^}]*["'`]/g), file).toBeNull();
  });

  it("sin window.confirm ni alert", () => {
    expect(code.match(/\b(?:window\.)?(?:confirm|alert)\(/g), file).toBeNull();
  });
});

describe("Puentes del marcado anterior", () => {
  const css = (rel: string) => readFileSync(join(root, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("pos.css ya no define clases pos-* y Administración no la importa", () => {
    expect(css("src/styles/pos.css")).not.toMatch(/\.pos-/);
    expect(readFileSync(join(root, "src/pages/AdminPage.tsx"), "utf8")).not.toContain("pos.css");
  });

  it("tokens.css ya no tiene los nombres anteriores", () => {
    expect(css("src/styles/tokens.css")).not.toMatch(/--(?:radio-panel|glass-fondo-lite|titulo-tracking|color-badge-fondo|tabla-cabecera-fondo)\s*:/);
  });
});
