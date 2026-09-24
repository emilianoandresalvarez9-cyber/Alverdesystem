import { test, expect } from '@playwright/test';

test.describe('Autenticación y Redirección (E2E)', () => {
  test('muestra la pantalla de login por defecto', async ({ page }) => {
    await page.goto('/');
    
    // Verificamos el título principal
    await expect(page.locator('h1')).toHaveText(/Todo el local/i);
    
    // Verificamos que el botón de ingresar exista y sea visible
    await expect(page.locator('button[type="submit"]', { hasText: /Ingresar/i })).toBeVisible();
  });
});
