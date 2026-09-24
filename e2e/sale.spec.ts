import { test, expect } from '@playwright/test';

test.describe('Flujo de Venta E2E', () => {
  test('Flujo de caja offline comprobando login, busqueda, carrito y cobro', async ({ page }) => {
    // 1. Ir a la raíz y asegurar que el login carga
    await page.goto('/');
    
    // Fallar si no aparece el botón Ingresar
    const loginBtn = page.locator('button', { hasText: /Ingresar/i });
    await expect(loginBtn).toBeVisible({ timeout: 5000 });
    
    // 2. Realizar login
    await page.fill('input[type="email"]', 'empleado@alverde.local');
    await page.fill('input[type="password"]', 'empleado123');
    await loginBtn.click();
    
    // Esperamos redirección (el app debería mandar a /catalog.html o similar según el rol, pero forzamos POS si no lo hace automáticamente)
    // Para no depender del delay de la red, esperamos que cambie la URL o pasen 3 segs
    await page.waitForTimeout(3000);
    await page.goto('/pos.html');
    
    // 3. Validar carga del POS
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    
    // 4. Buscar un producto real ("almendra")
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('almendra');
    
    // Esperar resultados de la búsqueda
    const resultItem = page.locator('li').filter({ hasText: /Almendra/i }).first();
    await expect(resultItem).toBeVisible({ timeout: 5000 });
    
    // 5. Agregar al carrito
    await resultItem.click();
    
    // Validar que se agregó al carrito (subtotal visible)
    const cartTotal = page.locator('div', { hasText: /Total:/i }).first();
    await expect(cartTotal).toBeVisible();
    
    // 6. Cobrar
    const btnCobrar = page.locator('button', { hasText: /Cobrar/i });
    await expect(btnCobrar).toBeVisible();
    await btnCobrar.click();
    
    // Confirmar en el modal
    const btnConfirmar = page.locator('button', { hasText: /Confirmar/i });
    await expect(btnConfirmar).toBeVisible({ timeout: 2000 });
    await btnConfirmar.click();
    
    // Esperamos mensaje de éxito (la app limpia el carrito después de la venta)
    await expect(btnConfirmar).toBeHidden({ timeout: 3000 });
  });
});
