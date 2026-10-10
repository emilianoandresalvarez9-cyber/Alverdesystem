import "../styles/global.css";
import "../styles/pos.css";
import { registerServiceWorker } from "../shared/offline/registerServiceWorker";
import { AppShell } from "../shared/components/AppShell";
import { CustomersPage } from "../modules/customers/CustomersPage";
import { mountPage } from "../shared/components/mountPage";

registerServiceWorker();
mountPage(
  <AppShell active="customers" title="Clientes y fiado">
    <CustomersPage />
  </AppShell>
);
