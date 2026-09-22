import { startOfflineSynchronization } from "./sync";

export function registerServiceWorker(): void {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.warn("No se pudo registrar el modo offline.", error);
      });
    });
  }

  startOfflineSynchronization();
}
