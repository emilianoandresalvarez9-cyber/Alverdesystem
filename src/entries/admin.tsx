import { createRoot } from "react-dom/client";
import "../styles/global.css";
import { registerServiceWorker } from "../shared/offline/registerServiceWorker";
import { AdminPage } from "../pages/AdminPage";

registerServiceWorker();
createRoot(document.getElementById("root")!).render(<AdminPage />);
