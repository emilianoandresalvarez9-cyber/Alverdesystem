import { createRoot } from "react-dom/client";
import "../styles/global.css";
import { registerServiceWorker } from "../shared/offline/registerServiceWorker";
import { CatalogPage } from "../pages/CatalogPage";

registerServiceWorker();
createRoot(document.getElementById("root")!).render(<CatalogPage />);
