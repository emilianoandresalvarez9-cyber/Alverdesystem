import { startOfflineSynchronization } from "./sync";
import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker(): void {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      // registerType 'autoUpdate' (vite.config.ts): la versión nueva se activa sola.
      registerSW({ immediate: true });
    });
  }

  startOfflineSynchronization();
}
