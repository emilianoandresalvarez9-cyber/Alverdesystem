import { startOfflineSynchronization } from "./sync";
import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker(): void {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log('Nueva versión disponible.');
        },
        onOfflineReady() {
          console.log('App lista para trabajar sin conexión.');
        }
      });
    });
  }

  startOfflineSynchronization();
}
