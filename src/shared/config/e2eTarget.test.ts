import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertLocalE2ETarget } from "../../../e2e/target";
import { isLocalSupabaseUrl } from "./validation";

// Las pruebas E2E crean usuarios y ventas: nunca deben correr contra el proyecto de la nube.
describe("E2E solo contra Supabase local", () => {
  let dir: string;
  const saved = process.env.VITE_SUPABASE_URL;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "alverde-e2e-"));
    delete process.env.VITE_SUPABASE_URL;
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (saved === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = saved;
  });

  it("reconoce solo direcciones locales", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("https://abcd.supabase.co")).toBe(false);
    expect(isLocalSupabaseUrl("https://localhost.attacker.com")).toBe(false);
    expect(isLocalSupabaseUrl(undefined)).toBe(false);
    expect(isLocalSupabaseUrl("no-es-url")).toBe(false);
  });

  it("corta si .env.local apunta a la nube (lo que deja `npm run local`)", () => {
    writeFileSync(join(dir, ".env.local"), "VITE_SUPABASE_URL=https://abcd.supabase.co\n");
    expect(() => assertLocalE2ETarget(dir)).toThrow(/solo corren contra Supabase local/);
  });

  it("corta si no hay configuración", () => {
    expect(() => assertLocalE2ETarget(dir)).toThrow(/\(vacía\)/);
  });

  it(".env.e2e.local local pisa a .env.local de la nube", () => {
    writeFileSync(join(dir, ".env.local"), "VITE_SUPABASE_URL=https://abcd.supabase.co\n");
    writeFileSync(join(dir, ".env.e2e.local"), "VITE_SUPABASE_URL=http://127.0.0.1:54321\n");
    expect(assertLocalE2ETarget(dir)).toBe("http://127.0.0.1:54321");
  });

  it("una variable de entorno de la nube también corta, aunque el archivo sea local", () => {
    writeFileSync(join(dir, ".env.e2e.local"), "VITE_SUPABASE_URL=http://127.0.0.1:54321\n");
    process.env.VITE_SUPABASE_URL = "https://abcd.supabase.co";
    expect(() => assertLocalE2ETarget(dir)).toThrow();
  });

  it("playwright.config.ts aplica el control antes de correr nada", () => {
    const run = spawnSync("npx", ["playwright", "test", "--list"], {
      encoding: "utf8",
      env: { ...process.env, VITE_SUPABASE_URL: "https://abcd.supabase.co", CI: "" },
      timeout: 60_000
    });
    expect(run.status).not.toBe(0);
    expect(`${run.stdout}${run.stderr}`).toMatch(/solo corren contra Supabase local/);
  }, 60_000);
});
