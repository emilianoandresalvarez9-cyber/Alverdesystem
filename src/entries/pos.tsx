import { createRoot } from "react-dom/client";
import "../styles/tokens.css";
import "../styles/global.css";
import "../styles/pos.css";
import { registerServiceWorker } from "../shared/offline/registerServiceWorker";
import { AppShell } from "../shared/components/AppShell";
import { PosPage } from "../modules/pos/PosPage";

registerServiceWorker();
createRoot(document.getElementById("root")!).render(
  <AppShell active="pos" title="Caja">
    <PosPage />
  </AppShell>
);
