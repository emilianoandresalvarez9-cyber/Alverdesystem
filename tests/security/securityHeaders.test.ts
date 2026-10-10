/// <reference types="node" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Plugin, ResolvedConfig } from "vite";
import { contentSecurityPolicy, headersFile, inlineScriptHashes, supabaseOrigins } from "../../scripts/securityHeaders";
import { securityHeaders } from "../../vite.config";

const sha = (body: string) => `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`;
const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("cabeceras de seguridad (Cloudflare Pages)", () => {
  it("toma el hash de cada script en línea, no de los que vienen de un archivo", () => {
    const html = `<script>var a = 1;</script><script type="module" src="/assets/x.js"></script><script> </script>`;
    expect(inlineScriptHashes(html)).toEqual([sha("var a = 1;")]);
  });

  it("el script del tema de las páginas reales queda permitido por su hash", () => {
    const html = readFileSync("index.html", "utf8");
    const [themeHash] = inlineScriptHashes(html);
    expect(themeHash).toBeDefined();
    const scriptSrc = directive(contentSecurityPolicy({ scriptHashes: inlineScriptHashes(html) }), "script-src");
    expect(scriptSrc).toContain(themeHash);
  });

  it("los scripts sólo vienen del sitio: sin unsafe-inline ni unsafe-eval", () => {
    const csp = contentSecurityPolicy({ scriptHashes: [sha("x")] });
    expect(directive(csp, "script-src")).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
  });

  it("nadie puede meter la caja en un iframe de otro sitio", () => {
    const file = headersFile({ scriptHashes: [] });
    expect(file).toContain("frame-ancestors 'none'");
    expect(file).toContain("X-Frame-Options: DENY");
    expect(file).toContain("X-Content-Type-Options: nosniff");
  });

  it("los datos sólo van al sitio y al proyecto de Supabase configurado", () => {
    expect(supabaseOrigins("https://abcd.supabase.co")).toEqual(["https://abcd.supabase.co", "wss://abcd.supabase.co"]);
    expect(supabaseOrigins("http://127.0.0.1:54321")).toEqual(["http://127.0.0.1:54321", "ws://127.0.0.1:54321"]);
    expect(supabaseOrigins(undefined)).toEqual(["https://*.supabase.co", "wss://*.supabase.co"]);
    const connect = directive(contentSecurityPolicy({ scriptHashes: [], supabaseUrl: "https://abcd.supabase.co" }), "connect-src");
    expect(connect).toBe("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co");
  });

  it("la build escribe _headers con el hash de los HTML que armó y la URL configurada", () => {
    const plugin: Plugin = securityHeaders();
    (plugin.configResolved as unknown as (c: ResolvedConfig) => void)({ env: { VITE_SUPABASE_URL: "https://abcd.supabase.co" } } as unknown as ResolvedConfig);
    const emitted: { fileName: string; source: string }[] = [];
    const bundle = {
      "index.html": { type: "asset", fileName: "index.html", source: "<script>tema()</script>" },
      "pos.html": { type: "asset", fileName: "pos.html", source: "<script>tema()</script>" },
      "assets/app.js": { type: "chunk", fileName: "assets/app.js", code: "<script>no es html</script>" }
    };
    (plugin.generateBundle as unknown as (this: unknown, o: unknown, b: unknown) => void)
      .call({ emitFile: (file: { fileName: string; source: string }) => emitted.push(file) }, {}, bundle);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.fileName).toBe("_headers");
    const source = emitted[0]?.source ?? "";
    expect(source.match(/sha256-/g)).toHaveLength(1);
    expect(source).toContain(sha("tema()"));
    expect(source).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co");
    expect(source.startsWith("# Generado")).toBe(true);
    expect(source).toContain("\n/*\n  Content-Security-Policy: ");
  });
});
