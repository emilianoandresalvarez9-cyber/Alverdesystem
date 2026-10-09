import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileContext } from "../../src/shared/auth/AuthGate";
import { ShellLayout } from "../../src/shared/components/AppShell";
import { LoginPage } from "../../src/pages/LoginPage";

/**
 * El shell (barra lateral, cabecera, panel central) y el selector de tema
 * (RNF-06/RNF-08). Se renderiza a HTML estático con un `document` mínimo:
 * el botón de tema lee <html data-theme> al montar.
 */
const fakeDocument = { documentElement: { getAttribute: () => "midnight-bio" } };
let previous: unknown;
beforeAll(() => { previous = (globalThis as { document?: unknown }).document; (globalThis as { document?: unknown }).document = fakeDocument; });
afterAll(() => { (globalThis as { document?: unknown }).document = previous; });

function renderShell(role: "administrator" | "employee") {
  return renderToStaticMarkup(
    <ProfileContext.Provider value={{ id: "u1", role, active: true }}>
      <ShellLayout active="pos" title="Caja"><p>contenido</p></ShellLayout>
    </ProfileContext.Provider>
  );
}

describe("AppShell", () => {
  it("anima barra lateral, cabecera y panel central como bloques separados (RNF-08)", () => {
    const html = renderShell("employee");
    for (const name of ["app-sidebar", "app-header", "app-content"]) {
      expect(html, `falta view-transition-name:${name}`).toContain(`view-transition-name:${name}`);
    }
  });

  it("muestra el selector de tema con el tema actual y marca la sección activa", () => {
    const html = renderShell("employee");
    expect(html).toContain('class="button button-secondary theme-toggle"');
    expect(html).toContain("Diseño: Midnight");
    expect(html).toMatch(/<a class="active" href="\/pos\.html" aria-current="page"/);
  });

  it("muestra en todas las páginas si hay operaciones pendientes de sincronizar (RF-36)", () => {
    const html = renderShell("employee");
    expect(html).toContain('class="sync-status');
    expect(html).toMatch(/operaci(ón|ones) pendiente/);
  });

  it("Empleado no ve el acceso a Administración; Administrador sí (RNF-04)", () => {
    expect(renderShell("employee")).not.toContain("/admin.html");
    expect(renderShell("employee")).toContain(">Empleado<");
    expect(renderShell("administrator")).toContain("/admin.html");
    expect(renderShell("administrator")).toContain(">Administrador<");
  });
});

describe("Login", () => {
  it("también ofrece el selector de tema, antes de iniciar sesión", () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain("theme-toggle");
    expect(html).toContain("Diseño: Midnight");
  });
});
