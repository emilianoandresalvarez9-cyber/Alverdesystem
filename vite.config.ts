/// <reference types="vitest" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { findSecretKeys, isSecretSupabaseKey } from "./src/shared/config/secretKeys";
import { headersFile, inlineScriptHashes } from "./scripts/securityHeaders";

/**
 * RNF-08: la transición entre páginas anima de marco a marco sólo si la página nueva ya
 * muestra el marco (barra lateral, cabecera) en su primer cuadro. `blocking="render"`
 * hace que el navegador espere al script de la página antes de pintar, y cada entrada
 * monta React de forma síncrona (src/shared/components/mountPage.tsx).
 */
export function renderBlockingEntries(): Plugin {
  return {
    name: "alverde-render-blocking",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace(/<script type="module"(?![^>]*\bblocking=)/g, '<script type="module" blocking="render"');
    }
  };
}

/**
 * Credenciales: las variables `VITE_*` quedan escritas en el JavaScript publicado. Si alguien
 * pega la clave secreta de Supabase (service_role / sb_secret_) en VITE_SUPABASE_ANON_KEY u otra
 * variable, cualquiera que abra el sitio podría leer y escribir toda la base salteando RLS.
 * La build se corta antes de generar o publicar nada, y nombra la variable sin mostrar la clave.
 */
export function noSecretKeysInBundle(): Plugin {
  return {
    name: "alverde-no-secret-keys",
    configResolved(config) {
      for (const [name, value] of Object.entries(config.env)) {
        if (typeof value !== "string" || !name.startsWith("VITE_")) continue;
        if (isSecretSupabaseKey(value) || findSecretKeys(value).length > 0) {
          throw new Error(
            `${name} tiene una clave SECRETA de Supabase (service_role / sb_secret_). Todo lo que empieza con VITE_ ` +
              "se publica dentro del sitio. Usá la clave pública anon/publishable y rotá la secreta en Supabase → Project Settings → API."
          );
        }
      }
    },
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        const text = file.type === "chunk" ? file.code : typeof file.source === "string" ? file.source : "";
        const found = findSecretKeys(text);
        if (found.length > 0) {
          this.error(`${file.fileName} contiene ${found.join(" y ")} de Supabase. No se publica una build con claves secretas.`);
        }
      }
    }
  };
}

/**
 * Cabeceras de seguridad (scripts/securityHeaders.ts): escribe `_headers` en la raíz de la build,
 * que Cloudflare Pages aplica a todo el sitio. Corre después de que Vite arma los HTML, así toma
 * el hash de cada script en línea que quedó en ellos (hoy, el del tema).
 */
export function securityHeaders(): Plugin {
  let supabaseUrl: string | undefined;
  return {
    name: "alverde-security-headers",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      const value = config.env.VITE_SUPABASE_URL;
      supabaseUrl = typeof value === "string" ? value : undefined;
    },
    generateBundle(_options, bundle) {
      const hashes: string[] = [];
      for (const file of Object.values(bundle)) {
        if (file.type === "asset" && file.fileName.endsWith(".html") && typeof file.source === "string") {
          hashes.push(...inlineScriptHashes(file.source));
        }
      }
      this.emitFile({ type: "asset", fileName: "_headers", source: headersFile({ scriptHashes: hashes, supabaseUrl }) });
    }
  };
}

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/e2e/**']
  },
  plugins: [
    react(),
    renderBlockingEntries(),
    noSecretKeysInBundle(),
    securityHeaders(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Alverde System',
        short_name: 'Alverde',
        description: 'Punto de Venta y Gestión de Stock',
        theme_color: '#f1f3ed',
        background_color: '#f1f3ed',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf}']
      }
    })
  ],
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        login: fileURLToPath(new URL("./index.html", import.meta.url)),
        catalog: fileURLToPath(new URL("./catalog.html", import.meta.url)),
        admin: fileURLToPath(new URL("./admin.html", import.meta.url)),
        stock: fileURLToPath(new URL("./stock.html", import.meta.url)),
        pos: fileURLToPath(new URL("./pos.html", import.meta.url)),
        customers: fileURLToPath(new URL("./customers.html", import.meta.url))
      }
    }
  }
});
