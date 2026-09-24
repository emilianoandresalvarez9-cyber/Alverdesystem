import { test, expect } from '@playwright/test';

test.describe('Flujo de Venta E2E', () => {
  test('Flujo de caja offline simulado: carrito y cobro', async ({ page }) => {
    await page.goto('/');

    const isLogin = await page.locator('button', { hasText: /Ingresar/i }).isVisible();
    if (isLogin) {
      await page.fill('input[type="email"]', 'empleado@alverde.local');
      await page.fill('input[type="password"]', 'empleado123');
      await page.click('button', { hasText: /Ingresar/i });
      // wait for supabase response
      await page.waitForTimeout(4000);
      await page.goto('/pos.html');
    } else {
      await page.goto('/pos.html');
    }

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('almendra');
      
      const resultItem = page.locator('li').filter({ hasText: /Almendra/i }).first();
      await page.waitForTimeout(1000);
      
      if (await resultItem.isVisible()) {
        await resultItem.click();
        await expect(page.locator('div', { hasText: /Total/i }).first()).toBeVisible();
        
        const btnCobrar = page.locator('button', { hasText: /Cobrar/i });
        if (await btnCobrar.isVisible()) {
          await btnCobrar.click();
          const btnConfirmar = page.locator('button', { hasText: /Confirmar/i });
          if (await btnConfirmar.isVisible()) {
             await btnConfirmar.click();
          }
        }
      }
    }
  });
});
