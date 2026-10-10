import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Ingresar con el sistema de diseño (RNF-06): la pantalla de IngresarEscritorio /
 * IngresarCelular, y la espera de AuthGate con las mismas clases. Ninguna usa ya el
 * marcado anterior, así que el puente de global.css quedó vacío.
 */
const config = vi.hoisted(() => ({ ok: true }));
vi.mock("../../src/shared/config/env", () => ({
  env: { supabaseUrl: "", supabaseAnonKey: "" },
  get hasSupabaseConfig() { return config.ok; }
}));

const { LoginPage } = await import("../../src/pages/LoginPage");
const { AuthGate } = await import("../../src/shared/auth/AuthGate");

const globals = globalThis as { document?: unknown; localStorage?: unknown };
let previous: { document?: unknown; localStorage?: unknown };
beforeAll(() => {
  previous = { document: globals.document, localStorage: globals.localStorage };
  globals.document = { documentElement: { getAttribute: () => "alverde-botanical" } };
  globals.localStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
});
afterAll(() => { globals.document = previous.document; globals.localStorage = previous.localStorage; });

const OLD_CLASSES = /class="[^"]*\b(?:login-page|login-card|login-theme|glass|brand|lockup|eyebrow|notice|form-error|loading-card)\b/;

describe("Ingresar", () => {
  it("marca, título, correo, contraseña, Ingresar y el tema al pie, con las clases del sistema", () => {
    config.ok = true;
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toMatch(/^<main class="login"><section class="carta login__carta"/);
    expect(html).toContain('<span class="marca__nombre">alverde</span><span class="marca__bajada">Dietética natural</span>');
    // e2e/auth.spec busca este h1.
    expect(html).toMatch(/<h1 class="titulo-modal"[^>]*>Todo el local, claro y en orden\.<\/h1>/);
    expect(html).toMatch(/<label class="campo__etiqueta" for="([^"]+)">Correo electrónico<\/label><div class="entrada"><input id="\1" type="email" autoComplete="email" required=""/);
    expect(html).toMatch(/<label class="campo__etiqueta" for="([^"]+)">Contraseña<\/label><div class="entrada"><input id="\1" type="password" autoComplete="current-password" required=""/);
    expect(html).toMatch(/<button type="submit" class="boton boton--primario boton--bloque">Ingresar<\/button>/);
    // El tema se elige antes de entrar, abajo de Ingresar.
    expect(html.indexOf("boton-tema")).toBeGreaterThan(html.indexOf("Ingresar"));
    expect(html).toContain("Tema: Botanical");
    expect(html).not.toMatch(OLD_CLASSES);
  });

  it("sin la configuración de Supabase avisa qué falta y no muestra el formulario", () => {
    config.ok = false;
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toMatch(/<div class="mensaje mensaje--aviso" role="status">.*Falta configurar la conexión/);
    expect(html).toContain('<span class="codigo">.env.local</span>');
    expect(html).not.toContain("<form");
    expect(html).toContain("boton-tema");
    config.ok = true;
  });
});

describe("AuthGate mientras comprueba el acceso", () => {
  it("muestra la carta de Ingresar con un estado vacío, anunciado como estado", () => {
    const html = renderToStaticMarkup(<AuthGate requiredRole="administrator"><p>panel</p></AuthGate>);
    expect(html).toMatch(/^<main class="login" aria-busy="true"><div class="carta login__carta" role="status"><div class="vacio">/);
    expect(html).toContain("<strong>Comprobando acceso…</strong>");
    expect(html).not.toContain("panel");
    expect(html).not.toMatch(OLD_CLASSES);
  });
});

describe("global.css", () => {
  it("ya no tiene el puente del marcado anterior: sólo importa las hojas del sistema", () => {
    const css = readFileSync(join(process.cwd(), "src/styles/global.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = css.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("@import"));
    expect(rules).toEqual([]);
  });
});
