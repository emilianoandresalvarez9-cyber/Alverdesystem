import { createRoot } from "react-dom/client";
import "../styles/global.css";
import { registerServiceWorker } from "../shared/offline/registerServiceWorker";
import { LoginPage } from "../pages/LoginPage";

registerServiceWorker();
createRoot(document.getElementById("root")!).render(<LoginPage />);
