import "../styles/global.css";
import "../styles/pos.css";
import { registerServiceWorker } from "../shared/offline/registerServiceWorker";
import { AppShell } from "../shared/components/AppShell";
import { PosPage } from "../modules/pos/PosPage";
import { mountPage } from "../shared/components/mountPage";

registerServiceWorker();
mountPage(
  <AppShell active="pos" title="Caja">
    <PosPage />
  </AppShell>
);
