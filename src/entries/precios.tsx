import "../styles/global.css";
import "../styles/storefront.css";
import { PublicPricesPage } from "../pages/PublicPricesPage";
import { mountPage } from "../shared/components/mountPage";

// Página pública: sin sesión y sin service worker propio (no guarda datos del local en el equipo
// del visitante).
mountPage(<PublicPricesPage />);
