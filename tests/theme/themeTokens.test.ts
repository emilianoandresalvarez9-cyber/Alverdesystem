import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Theme Token Parity", () => {
  it("botanical and midnight define exactly the same CSS variables", () => {
    const rootDir = process.cwd();
    const bot = readFileSync(join(rootDir, "src/styles/themes/alverde-botanical.css"), "utf8");
    const mid = readFileSync(join(rootDir, "src/styles/themes/midnight-bio.css"), "utf8");

    const getVars = (css: string) => {
      const vars = new Set<string>();
      const matches = css.matchAll(/^\s*(--(?!ds-)[a-zA-Z0-9-]+)\s*:/gm);
      for (const m of matches) {
        vars.add(m[1]);
      }
      return vars;
    };

    const botVars = getVars(bot);
    const midVars = getVars(mid);

    const botOnly = [...botVars].filter(x => !midVars.has(x));
    const midOnly = [...midVars].filter(x => !botVars.has(x));

    expect(botOnly, `Variables only in botanical: ${botOnly.join(", ")}`).toEqual([]);
    expect(midOnly, `Variables only in midnight: ${midOnly.join(", ")}`).toEqual([]);
  });
});

describe("Valores del paquete de Claude Design", () => {
  // Si alguien toca un color a mano, el contraste medido en el paquete (accesibilidad.md) deja de valer.
  const rootDir = process.cwd();
  const read = (rel: string) => readFileSync(join(rootDir, rel), "utf8");
  const value = (css: string, name: string) => css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();

  it("los colores principales de cada tema son los medidos para AA", () => {
    const bot = read("src/styles/themes/alverde-botanical.css");
    const mid = read("src/styles/themes/midnight-bio.css");
    expect(value(bot, "--color-fondo")).toBe("#f1f3ed");
    expect(value(bot, "--color-tinta")).toBe("#1b2318");
    expect(value(bot, "--color-acento")).toBe("#2c6620");
    expect(value(mid, "--color-fondo")).toBe("#111511");
    expect(value(mid, "--color-tinta")).toBe("#d6dccf");
    expect(value(mid, "--color-acento")).toBe("#a8cc80");
  });

  it("el foco es un color sólido, no una sombra (se usa en outline: 2px solid)", () => {
    for (const file of ["src/styles/themes/alverde-botanical.css", "src/styles/themes/midnight-bio.css"]) {
      expect(value(read(file), "--foco-anillo"), file).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("cinco tamaños de texto más la cifra del total", () => {
    const tokens = read("src/styles/tokens.css");
    expect(["--texto-xs", "--texto-s", "--texto-m", "--texto-l", "--texto-titulo", "--texto-cifra"].map((n) => value(tokens, n)))
      .toEqual(["12px", "14px", "16px", "20px", "24px", "48px"]);
  });
});
