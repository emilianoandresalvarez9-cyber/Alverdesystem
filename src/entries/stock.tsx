import "../styles/global.css";
import { registerServiceWorker } from "../shared/offline/registerServiceWorker";
import { StockPage } from "../pages/StockPage";
import { mountPage } from "../shared/components/mountPage";

registerServiceWorker();
mountPage(<StockPage />);
