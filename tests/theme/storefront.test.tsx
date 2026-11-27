import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { PriceListState } from "../../src/modules/storefront/usePriceList";
import { groupProducts } from "../../src/modules/storefront/priceList";

/**
 * Sitio público (precios.html): identidad propia (lima y brote) sin romper las reglas del sistema.
 * La hoja tiene una paleta --sitio-* para los dos temas y fuera de ella no fija colores.
 */
const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const definedVars = (css: string) => new Set([...stripComments(css).matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]));
const usedVars = (css: string) => new Set([...stripComments(css).matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)].map((m) => m[1]));

describe("src/styles/storefront.css", () => {
  const sheet = stripComments(read("src/styles/storefront.css"));

  it("los colores sueltos viven sólo en la paleta --sitio-*", () => {
    const withoutPalette = sheet.replace(/--sitio-[a-z-]+\s*:[^;]+;/g, "");
    const literal = withoutPalette.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|color-mix)\(|\b(?:white|black|red|green|blue|gray|grey)\b(?!-)/g);
    expect(literal, `colores fuera de la paleta: ${literal?.join(", ")}`).toBeNull();
  });

  it("la marca usa la lima #e1ff82 y el tema oscuro redefine el panel", () => {
    expect(sheet).toMatch(/--sitio-lima:\s*#e1ff82/);
    expect(sheet).toMatch(/\[data-theme="midnight-bio"\] \.sitio\s*\{[^}]*--sitio-panel:/);
  });

  it("cada variable que usa está definida en la hoja, en tokens.css o en los dos temas", () => {
    const botanical = definedVars(read("src/styles/themes/alverde-botanical.css"));
    const midnight = definedVars(read("src/styles/themes/midnight-bio.css"));
    const tokens = definedVars(read("src/styles/tokens.css"));
    const local = definedVars(sheet);
    const missing = [...usedVars(sheet)].filter((v) => !local.has(v) && !tokens.has(v) && !(botanical.has(v) && midnight.has(v)));
    expect(missing, `variables sin definir: ${missing.join(", ")}`).toEqual([]);
  });

  it("con «reducir movimiento» no queda ninguna animación y la escena se ve completa", () => {
    const reduced = sheet.slice(sheet.indexOf("prefers-reduced-motion"));
    expect(reduced).toMatch(/animation:\s*none\s*!important/);
    expect(reduced).toMatch(/\.escena__entra\s*\{\s*opacity:\s*1/);
    expect(reduced).toMatch(/\.escena__tallo\s*\{\s*stroke-dashoffset:\s*0/);
  });
});

const state = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/modules/storefront/usePriceList", () => ({ usePriceList: () => state.current }));
vi.mock("../../src/shared/theme/ThemeToggle", () => ({ ThemeToggle: () => null }));
const { PublicPricesPage } = await import("../../src/pages/PublicPricesPage");

const base: PriceListState = {
  products: [], branches: [], branchId: null, setBranchId: () => undefined,
  isLoading: false, failed: false, updatedAt: 1_000, now: 1_000, changed: new Set()
};
const rows = [
  { presentation_id: "c1", product_id: "f1", product_name: "Almendras", brand_name: "Del local", category_name: "Frutos secos", presentation_name: "Bolsa 250 g", sold_by_weight: false, price: 4000, availability: "disponible" },
  { presentation_id: "c2", product_id: "f1", product_name: "Almendras", brand_name: "Del local", category_name: "Frutos secos", presentation_name: "Granel", sold_by_weight: true, price: 14.8, availability: "ultimas" },
  { presentation_id: "c3", product_id: "f2", product_name: "Yerba", brand_name: null, category_name: null, presentation_name: "Paquete 500 g", sold_by_weight: false, price: 3200.5, availability: "sin_stock" }
];
const render = (patch: Partial<PriceListState>) => {
  state.current = { ...base, ...patch };
  return renderToStaticMarkup(<PublicPricesPage />);
};

describe("Sitio público: página", () => {
  it("muestra la marca con el brote, la portada animada y el acceso del personal", () => {
    const html = render({ products: groupProducts(rows) });
    expect(html).toContain('<span class="sitio__nombre">alverde</span>');
    expect(html).toMatch(/<svg class="brote"/);
    expect(html).toMatch(/<svg class="escena"[^>]*role="img"/);
    expect(html).toMatch(/<h1 class="portada__titulo"[^>]*>Comer rico y sano, todos los días\.<\/h1>/);
    expect(html).toContain('<a href="/">Ingreso del personal</a>');
  });

  it("cada presentación sale con su precio y su disponibilidad en palabras", () => {
    const html = render({ products: groupProducts(rows) });
    expect(html).toMatch(/Bolsa 250 g<\/span><span class="estado estado--exito">.*?Disponible<\/span><\/span><span class="precio">\$4\.000<\/span>/);
    expect(html).toMatch(/Granel<\/span><span class="estado estado--aviso">.*?Queda poco<\/span><\/span><span class="precio">\$14\.800\/kg<\/span>/);
    expect(html).toMatch(/<li class="apagada">.*?Paquete 500 g<\/span><span class="estado estado--neutro">Sin stock<\/span><\/span><span class="precio">\$3\.200,50<\/span>/);
    expect(html).toContain("2 productos");
  });

  it("resalta el precio que cambió en la última actualización, y sólo ese", () => {
    const html = render({ products: groupProducts(rows), changed: new Set(["c1"]) });
    expect(html.match(/sitio__precio--cambio/g)).toHaveLength(1);
    expect(html).toMatch(/<span class="precio sitio__precio--cambio">\$4\.000<\/span>/);
  });

  it("dice hace cuánto se actualizó y avisa si no pudo actualizar, sin borrar la lista", () => {
    expect(render({ products: groupProducts(rows), updatedAt: 1_000, now: 1_000 + 5 * 60_000 })).toContain("Actualizado hace 5 minutos");
    const stale = render({ products: groupProducts(rows), failed: true });
    expect(stale).toContain("No pudimos actualizar la lista");
    expect(stale).toContain("Almendras");
    expect(stale).toContain('class="sitio__vivo sitio__vivo--sin"');
  });

  it("sin lista y sin conexión explica qué pasó; con la base vacía, qué va a aparecer", () => {
    expect(render({ failed: true, updatedAt: null })).toContain("No pudimos traer la lista de precios");
    expect(render({})).toContain("Todavía no hay productos publicados");
  });

  it("con más de una sucursal deja elegir, y lista las que tienen dirección", () => {
    const html = render({
      products: groupProducts(rows),
      branches: [{ id: "b1", name: "Centro", address: "San Martín 100" }, { id: "b2", name: "Norte", address: null }]
    });
    expect(html).toMatch(/<select[^>]*><option value="b1" selected="">Centro<\/option><option value="b2">Norte<\/option><\/select>/);
    expect(html).toContain("Actualizado recién, sucursal Centro");
    expect(html).toMatch(/<span class="lista__titulo">Centro<\/span><span class="lista__meta">San Martín 100<\/span>/);
    expect(html).not.toMatch(/<span class="lista__titulo">Norte<\/span>/);
    expect(render({ products: groupProducts(rows), branches: [{ id: "b1", name: "Centro", address: null }] })).not.toContain("<select");
  });
});
