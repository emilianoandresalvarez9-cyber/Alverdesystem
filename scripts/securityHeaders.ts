/// <reference types="node" />
/**
 * Cabeceras de seguridad para Cloudflare Pages (archivo `_headers` en la raíz de la build).
 *
 * - Content-Security-Policy: sólo se ejecuta JavaScript del propio sitio y los scripts en línea
 *   de la build (el del tema), por su hash. Sin `unsafe-inline` ni `unsafe-eval` para scripts:
 *   si alguna vez se cuela HTML ajeno en una pantalla, no corre. Los datos sólo se envían al
 *   propio sitio y al proyecto de Supabase configurado.
 * - frame-ancestors / X-Frame-Options: nadie puede meter la caja dentro de otra página
 *   (clickjacking).
 * - nosniff, Referrer-Policy, Permissions-Policy, COOP y HSTS: endurecimiento estándar.
 *
 * Qué permite y por qué (revisado contra la build, octubre 2026):
 * - img-src data: blob: → los íconos son SVG en data: dentro del CSS; exportar un código de
 *   barras a PNG dibuja un blob: en un canvas.
 * - style-src 'unsafe-inline' → React usa atributos style (anchos de medidores, etc.).
 * - worker-src 'self' → el service worker del modo sin conexión.
 * Lo usa vite.config.ts (noSecretKeysInBundle está al lado). Sin APIs del navegador.
 */
import { createHash } from "node:crypto";

/** Hash CSP de cada <script> en línea (sin src) de un HTML. */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    const body = match[1] ?? "";
    if (!body.trim()) continue;
    hashes.push(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
  return hashes;
}

/** Orígenes de Supabase para connect-src (HTTP y tiempo real). Sin URL válida, cualquier proyecto *.supabase.co. */
export function supabaseOrigins(url: string | undefined): string[] {
  try {
    const parsed = new URL((url ?? "").trim());
    if (parsed.protocol === "https:") return [parsed.origin, `wss://${parsed.host}`];
    if (parsed.protocol === "http:") return [parsed.origin, `ws://${parsed.host}`];
  } catch {
    // sin URL configurada (por ejemplo, la build del CI): comodín de Supabase
  }
  return ["https://*.supabase.co", "wss://*.supabase.co"];
}

export function contentSecurityPolicy({ scriptHashes, supabaseUrl }: { scriptHashes: readonly string[]; supabaseUrl?: string }): string {
  const hashes = [...new Set(scriptHashes)].sort();
  return [
    "default-src 'self'",
    ["script-src 'self'", ...hashes].join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    ["connect-src 'self'", ...supabaseOrigins(supabaseUrl)].join(" "),
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; ");
}

/** Contenido de `_headers` (formato de Cloudflare Pages: ruta y cabeceras con dos espacios). */
export function headersFile(input: { scriptHashes: readonly string[]; supabaseUrl?: string }): string {
  return [
    "# Generado por vite.config.ts (securityHeaders). No editar a mano: se rehace en cada build.",
    "/*",
    `  Content-Security-Policy: ${contentSecurityPolicy(input)}`,
    "  X-Frame-Options: DENY",
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "  Cross-Origin-Opener-Policy: same-origin",
    "  Strict-Transport-Security: max-age=31536000",
    ""
  ].join("\n");
}
