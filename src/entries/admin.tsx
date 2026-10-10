import "../styles/global.css";
import { registerServiceWorker } from "../shared/offline/registerServiceWorker";
import { AdminPage } from "../pages/AdminPage";
import { mountPage } from "../shared/components/mountPage";

registerServiceWorker();
mountPage(<AdminPage />);
