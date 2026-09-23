import { createRoot } from "react-dom/client";
import "../styles/tokens.css";
import "../styles/global.css";
import "../styles/pos.css";
import { registerServiceWorker } from "../shared/offline/registerServiceWorker";
import { AppShell } from "../shared/components/AppShell";
import { CustomersPage } from "../modules/customers/CustomersPage";

registerServiceWorker();
createRoot(document.getElementById("root")!).render(
  <AppShell active="customers" title="Clientes y fiado">
    <CustomersPage />
  </AppShell>
);
