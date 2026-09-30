import { createRoot } from "react-dom/client";
import "../styles/tokens.css";
import "../styles/global.css";
import { registerServiceWorker } from "../shared/offline/registerServiceWorker";
import { StockPage } from "../pages/StockPage";

registerServiceWorker();
createRoot(document.getElementById("root")!).render(<StockPage />);
