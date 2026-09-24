/// <reference types="vitest" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/e2e/**']
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Alverde System',
        short_name: 'Alverde',
        description: 'Punto de Venta y Gestión de Stock',
        theme_color: '#ffffff',
        background_color: '#ffffff',
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
        pos: fileURLToPath(new URL("./pos.html", import.meta.url)),
        customers: fileURLToPath(new URL("./customers.html", import.meta.url))
      }
    }
  }
});
