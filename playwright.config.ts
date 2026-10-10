import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { E2E_MODE, assertLocalE2ETarget } from './e2e/target';

// Credenciales de prueba locales (TEST_EMPLOYEE_EMAIL, etc.), si las hay.
dotenv.config({ path: '.env.e2e.local' });

// Corta antes de levantar nada si la base no es local (los E2E escriben datos).
assertLocalE2ETarget();

// Puerto propio y servidor siempre nuevo: así nunca se reutiliza un `npm run dev` que esté
// apuntando a la nube, y el servidor usa exactamente la configuración que se acaba de validar.
const PORT = 5180;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // En CI, además del informe HTML, cada falla queda como anotación del job: se puede leer
  // desde la API de GitHub sin descargar el informe.
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npx vite --mode ${E2E_MODE} --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
  },
});
