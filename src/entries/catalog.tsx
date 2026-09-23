import { createRoot } from "react-dom/client";
import "../styles/tokens.css";
import "../styles/global.css";
import "../styles/catalog.css";
import { registerServiceWorker } from "../shared/offline/registerServiceWorker";
import { CatalogPage } from "../pages/CatalogPage";

registerServiceWorker();
createRoot(document.getElementById("root")!).render(<CatalogPage />);
