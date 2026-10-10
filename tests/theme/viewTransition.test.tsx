import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderBlockingEntries } from "../../vite.config";
import { AuthGate, optimisticProfile } from "../../src/shared/auth/AuthGate";
import { LAST_PROFILE_KEY, readLastProfile, storeLastProfile } from "../../src/shared/auth/session";

/**
 * RNF-08: la transición entre páginas sólo anima de marco a marco si la página nueva
 * muestra el marco en su primer cuadro. Para eso: el script de la página bloquea el
 * primer pintado y AuthGate dibuja con el último perfil verificado mientras verifica.
 */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data
  };
}

describe("Script de cada página", () => {
  it("bloquea el primer pintado hasta montar React (una sola vez por script)", () => {
    const plugin = renderBlockingEntries();
    const transform = plugin.transformIndexHtml as (html: string) => string;
    const html = '<script>tema()</script><script type="module" crossorigin src="/assets/pos.js"></script>';
    const out = transform(html);
    expect(out).toContain('<script type="module" blocking="render" crossorigin src="/assets/pos.js">');
    expect(out).toContain("<script>tema()</script>");
    expect(transform(out)).toBe(out);
  });
});

describe("Primer cuadro con el último perfil verificado", () => {
  const admin = { id: "u1", role: "administrator" as const, active: true };
  const employee = { id: "u2", role: "employee" as const, active: true };

  it("guarda y lee el perfil; un valor roto o inactivo no cuenta", () => {
    const storage = memoryStorage();
    storeLastProfile(admin, storage);
    expect(readLastProfile(storage)).toEqual(admin);
    storeLastProfile({ ...admin, active: false }, storage);
    expect(storage.data.has(LAST_PROFILE_KEY)).toBe(false);
    expect(readLastProfile(memoryStorage({ [LAST_PROFILE_KEY]: "{roto" }))).toBeNull();
    // Un rol desconocido cae al de menor privilegio.
    expect(readLastProfile(memoryStorage({ [LAST_PROFILE_KEY]: JSON.stringify({ id: "u3", role: "dueña", active: true }) })))
      .toEqual({ id: "u3", role: "employee", active: true });
  });

  it("el empleado no dibuja Administración ni siquiera un instante (RNF-04)", () => {
    expect(optimisticProfile("administrator", employee)).toBeNull();
    expect(optimisticProfile("administrator", admin)).toEqual(admin);
    expect(optimisticProfile(undefined, employee)).toEqual(employee);
    expect(optimisticProfile(undefined, null)).toBeNull();
  });

  describe("AuthGate", () => {
    let previous: unknown;
    beforeEach(() => { previous = (globalThis as { localStorage?: unknown }).localStorage; });
    afterEach(() => { (globalThis as { localStorage?: unknown }).localStorage = previous; });

    it("con perfil verificado antes, dibuja la página de entrada; sin él, «Comprobando acceso…»", () => {
      (globalThis as { localStorage?: unknown }).localStorage = memoryStorage({ [LAST_PROFILE_KEY]: JSON.stringify(admin) });
      expect(renderToStaticMarkup(<AuthGate requiredRole="administrator"><p>panel</p></AuthGate>)).toBe("<p>panel</p>");
      (globalThis as { localStorage?: unknown }).localStorage = memoryStorage();
      expect(renderToStaticMarkup(<AuthGate requiredRole="administrator"><p>panel</p></AuthGate>)).toContain("Comprobando acceso");
    });
  });
});
