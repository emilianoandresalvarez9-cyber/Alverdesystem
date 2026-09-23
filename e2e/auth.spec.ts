import { test, expect } from '@playwright/test';

test.describe('Autenticación y Redirección (E2E)', () => {
  test('muestra la pantalla de login por defecto', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText(/alverde/i);
    await expect(page.locator('button', { hasText: /Iniciar sesi/i })).toBeVisible();
  });
});
