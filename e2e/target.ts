import { loadEnv } from "vite";
import { isLocalSupabaseUrl } from "../src/shared/config/validation";

/** Modo de Vite de las pruebas E2E: lee .env.e2e.local, que pisa a .env.local. */
export const E2E_MODE = "e2e";

/**
 * Las pruebas E2E crean usuarios, ventas y movimientos de stock. Nunca deben correr contra el
 * proyecto Supabase de la nube: `npm run local` deja la URL real en .env.local y, sin este
 * control, `npm run test:e2e` escribía datos de prueba en producción.
 *
 * Lee la configuración igual que el servidor de desarrollo que levanta Playwright (archivos .env
 * del modo e2e y variables del entorno) y corta si la URL no es localhost.
 */
export function assertLocalE2ETarget(cwd = process.cwd()): string {
  const url = loadEnv(E2E_MODE, cwd, "VITE_").VITE_SUPABASE_URL;
  if (!url || !isLocalSupabaseUrl(url)) {
    throw new Error(
      `Las pruebas E2E solo corren contra Supabase local y la URL configurada es "${url ?? "(vacía)"}".\n` +
      "Levantá la base local con `supabase start` y creá .env.e2e.local con\n" +
      "  VITE_SUPABASE_URL=http://127.0.0.1:54321\n" +
      "  VITE_SUPABASE_ANON_KEY=<la anon key que muestra `supabase status`>\n" +
      "Ese archivo pisa a .env.local solo para las pruebas: tu configuración de `npm run local` no cambia."
    );
  }
  return url;
}
