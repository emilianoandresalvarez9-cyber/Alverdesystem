import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileContext } from "../../src/shared/auth/AuthGate";
import { ShellLayout } from "../../src/shared/components/AppShell";
import { connectionStatus } from "../../src/shared/components/OfflineIndicator";
import { LoginPage } from "../../src/pages/LoginPage";

/**
 * El marco (barra lateral, cabecera, contenido) y el selector de tema (RNF-06/RNF-08).
 * Se renderiza a HTML estático con un `document` mínimo: el botón de tema lee
 * <html data-theme> al montar.
 */
const fakeDocument = { documentElement: { getAttribute: () => "midnight-bio" } };
let previous: unknown;
beforeAll(() => { previous = (globalThis as { document?: unknown }).document; (globalThis as { document?: unknown }).document = fakeDocument; });
afterAll(() => { (globalThis as { document?: unknown }).document = previous; });

const designCss = readFileSync(join(process.cwd(), "src/styles/design-system.css"), "utf8");

function renderShell(role: "administrator" | "employee") {
  return renderToStaticMarkup(
    <ProfileContext.Provider value={{ id: "u1", role, active: true }}>
      <ShellLayout active="pos" title="Caja"><p>contenido</p></ShellLayout>
    </ProfileContext.Provider>
  );
}

describe("AppShell", () => {
  it("anima barra lateral, ítem activo, cabecera, título y contenido como bloques separados (RNF-08)", () => {
    const html = renderShell("employee");
    expect(designCss).toMatch(/@view-transition\s*\{\s*navigation:\s*auto;\s*\}/);
    const blocks: [string, string][] = [
      ["app-sidebar", "app-sidebar"], ["nav__indicador", "nav-activo"], ["app-header", "app-header"],
      ["app-titulo", "app-titulo"], ["app-content", "app-content"]
    ];
    for (const [cls, name] of blocks) {
      expect(html, `falta el bloque .${cls}`).toMatch(new RegExp(`class="[^"]*\\b${cls}\\b`));
      expect(designCss, `.${cls} no declara view-transition-name: ${name}`)
        .toMatch(new RegExp(`\\.${cls}\\s*\\{[^}]*view-transition-name:\\s*${name};`));
    }
    // La pastilla que se desliza existe una sola vez: si hubiera dos, la transición se rompe.
    expect(html.match(/nav__indicador/g)).toHaveLength(1);
    // Con movimiento reducido nada se desplaza: sólo un fundido.
    expect(designCss).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*::view-transition-group\(\*\)/);
  });

  it("muestra el botón de tema con el tema actual y marca la sección activa", () => {
    const html = renderShell("employee");
    expect(html).toContain('class="boton boton--fantasma boton-tema"');
    expect(html).toContain("Tema: Midnight");
    expect(html).toMatch(/<a class="nav__item" href="\/pos\.html" aria-current="page"><span class="nav__indicador"/);
    expect(html).not.toMatch(/href="\/catalog\.html" aria-current/);
  });

  it("muestra en todas las páginas la conexión y las operaciones pendientes (RF-36)", () => {
    const html = renderShell("employee");
    expect(html).toMatch(/<p class="conexion conexion--(ok|pendiente|sin)" role="status">/);
    expect(connectionStatus(true, 0)).toMatchObject({ tone: "ok", long: "Conectado" });
    expect(connectionStatus(true, 1)).toMatchObject({ tone: "pendiente", long: "Conectado · 1 operación pendiente", short: "1 pendiente" });
    expect(connectionStatus(true, 3)).toMatchObject({ long: "Conectado · 3 operaciones pendientes", short: "3 pendientes" });
    // Sin conexión siempre dice cuántas esperan, aunque sean cero.
    expect(connectionStatus(false, 0)).toMatchObject({ tone: "sin", long: "Sin conexión · 0 operaciones pendientes" });
    expect(connectionStatus(false, 2)).toMatchObject({ short: "Sin conexión · 2" });
  });

  it("Empleado no ve el acceso a Administración; Administrador sí (RNF-04)", () => {
    expect(renderShell("employee")).not.toContain("/admin.html");
    expect(renderShell("employee")).toMatch(/rol-insignia[^>]*>.*Empleado</);
    expect(renderShell("administrator")).toContain("/admin.html");
    expect(renderShell("administrator")).toMatch(/rol-insignia[^>]*>.*Administrador</);
    expect(renderShell("administrator")).toContain('<span class="nav__corta">Admin</span>');
  });

  it("en celular el menú de la cabecera arranca cerrado y dice qué tiene", () => {
    const html = renderShell("administrator");
    expect(html).toContain('aria-label="Menú: sucursal, tema y salir" aria-expanded="false"');
    expect(html).not.toContain("app-header__panel");
  });
});

describe("Login", () => {
  it("también ofrece el botón de tema, antes de iniciar sesión", () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain("boton-tema");
    expect(html).toContain("Tema: Midnight");
  });
});
