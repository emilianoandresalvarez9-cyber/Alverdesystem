import { describe, expect, it } from "vitest";
import type { Plugin, ResolvedConfig } from "vite";
import { findSecretKeys, isSecretSupabaseKey, jwtRole } from "./secretKeys";
import { isSupabaseConfigValid } from "./validation";
import { noSecretKeysInBundle } from "../../../vite.config";

// Las claves de prueba se arman al correr el test: en el código no queda nada con forma de clave real.
const b64url = (text: string) => Buffer.from(text).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fakeJwt = (role: string) =>
  [b64url('{"alg":"HS256","typ":"JWT"}'), b64url(JSON.stringify({ iss: "supabase", ref: "abcdefghijklmnop", role })), "firma-de-prueba-no-valida-0123"].join(".");
const SERVICE = fakeJwt("service_role");
const ANON = fakeJwt("anon");
const SB_SECRET = ["sb", "secret", "PruebaNoValida0123456789"].join("_");
const SB_PUBLISHABLE = ["sb", "publishable", "PruebaNoValida0123456789"].join("_");

describe("claves secretas de Supabase (nunca en el navegador)", () => {
  it("reconoce la clave service_role y la sb_secret_", () => {
    expect(jwtRole(SERVICE)).toBe("service_role");
    expect(isSecretSupabaseKey(SERVICE)).toBe(true);
    expect(isSecretSupabaseKey(SB_SECRET)).toBe(true);
    expect(isSecretSupabaseKey(fakeJwt("supabase_admin"))).toBe(true);
  });

  it("la clave pública anon/publishable no es secreta", () => {
    expect(jwtRole(ANON)).toBe("anon");
    expect(isSecretSupabaseKey(ANON)).toBe(false);
    expect(isSecretSupabaseKey(SB_PUBLISHABLE)).toBe(false);
    expect(isSecretSupabaseKey("")).toBe(false);
    expect(isSecretSupabaseKey("replace-with-your-anon-key")).toBe(false);
  });

  it("una configuración con la clave secreta no es válida para la app", () => {
    expect(isSupabaseConfigValid("https://abc.supabase.co", ANON)).toBe(true);
    expect(isSupabaseConfigValid("https://abc.supabase.co", SERVICE)).toBe(false);
    expect(isSupabaseConfigValid("https://abc.supabase.co", SB_SECRET)).toBe(false);
  });

  it("encuentra claves secretas dentro de un archivo, sin repetirlas en el aviso", () => {
    const code = `const a="${ANON}";const b="${SERVICE}";const c="${SB_SECRET}";`;
    const found = findSecretKeys(code);
    expect(found).toEqual(["1 clave(s) sb_secret_", "1 JWT con rol service_role"]);
    expect(found.join(" ")).not.toContain(SERVICE);
    expect(findSecretKeys(`createClient(url,"${ANON}")`)).toEqual([]);
  });
});

describe("la build no publica una clave secreta (vite.config.ts)", () => {
  type Hook = (...args: unknown[]) => void;
  const hook = (plugin: Plugin, name: "configResolved" | "generateBundle") => plugin[name] as unknown as Hook;
  const resolved = (env: Record<string, string>) => ({ env: { MODE: "production", ...env } }) as unknown as ResolvedConfig;
  const context = { error: (message: string) => { throw new Error(message); } };

  it("corta la build si una variable VITE_ trae la clave secreta, y nombra la variable sin mostrarla", () => {
    const plugin = noSecretKeysInBundle();
    expect(() => hook(plugin, "configResolved")(resolved({ VITE_SUPABASE_ANON_KEY: SERVICE }))).toThrow(/VITE_SUPABASE_ANON_KEY/);
    expect(() => hook(plugin, "configResolved")(resolved({ VITE_OTRA: SB_SECRET }))).toThrow(/VITE_OTRA/);
    try {
      hook(plugin, "configResolved")(resolved({ VITE_SUPABASE_ANON_KEY: SERVICE }));
    } catch (error) {
      expect(String(error)).not.toContain(SERVICE);
    }
  });

  it("deja pasar la clave pública", () => {
    const plugin = noSecretKeysInBundle();
    expect(() => hook(plugin, "configResolved")(resolved({ VITE_SUPABASE_URL: "https://abc.supabase.co", VITE_SUPABASE_ANON_KEY: ANON }))).not.toThrow();
  });

  it("frena un archivo de la build que tenga una clave secreta escrita a mano", () => {
    const plugin = noSecretKeysInBundle();
    const bundle = {
      "assets/pos-abc.js": { type: "chunk", fileName: "assets/pos-abc.js", code: `const k="${SERVICE}";` },
      "assets/app.css": { type: "asset", fileName: "assets/app.css", source: "body{}" }
    };
    expect(() => hook(plugin, "generateBundle").call(context, {}, bundle)).toThrow(/assets\/pos-abc\.js contiene 1 JWT con rol service_role/);
    const clean = { "assets/pos-abc.js": { type: "chunk", fileName: "assets/pos-abc.js", code: `const k="${ANON}";` } };
    expect(() => hook(plugin, "generateBundle").call(context, {}, clean)).not.toThrow();
  });
});
