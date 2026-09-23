import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
