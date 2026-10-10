import "../styles/global.css";
import "../styles/catalog.css";
import { registerServiceWorker } from "../shared/offline/registerServiceWorker";
import { CatalogPage } from "../pages/CatalogPage";
import { mountPage } from "../shared/components/mountPage";

registerServiceWorker();
mountPage(<CatalogPage />);
