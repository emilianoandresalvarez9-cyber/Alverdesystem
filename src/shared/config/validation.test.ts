import { describe, expect, it } from "vitest";
import { isSupabaseConfigValid } from "./validation";

const KEY = "x".repeat(40);

describe("isSupabaseConfigValid (CRÍTICO-01)", () => {
  it("acepta Supabase local por HTTP (supabase start)", () => {
    expect(isSupabaseConfigValid("http://127.0.0.1:54321", KEY)).toBe(true);
    expect(isSupabaseConfigValid("http://localhost:54321", KEY)).toBe(true);
  });

  it("acepta cualquier host por HTTPS", () => {
    expect(isSupabaseConfigValid("https://abc.supabase.co", KEY)).toBe(true);
  });

  it("rechaza HTTP hacia un host remoto", () => {
    expect(isSupabaseConfigValid("http://abc.supabase.co", KEY)).toBe(false);
    expect(isSupabaseConfigValid("http://192.168.0.10:54321", KEY)).toBe(false);
  });

  it("rechaza URL inválida, vacía o la clave de ejemplo", () => {
    expect(isSupabaseConfigValid("", KEY)).toBe(false);
    expect(isSupabaseConfigValid("no-es-url", KEY)).toBe(false);
    expect(isSupabaseConfigValid("https://abc.supabase.co", "")).toBe(false);
    expect(isSupabaseConfigValid("https://abc.supabase.co", "replace-with-key")).toBe(false);
  });
});
