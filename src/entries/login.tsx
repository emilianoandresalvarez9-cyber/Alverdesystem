import "../styles/global.css";
import { registerServiceWorker } from "../shared/offline/registerServiceWorker";
import { LoginPage } from "../pages/LoginPage";
import { mountPage } from "../shared/components/mountPage";

registerServiceWorker();
mountPage(<LoginPage />);
