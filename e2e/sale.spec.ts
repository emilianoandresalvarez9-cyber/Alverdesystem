import { test, expect } from '@playwright/test';

test.describe('Flujo de Venta E2E', () => {
  test('Flujo de caja offline comprobando login, busqueda, carrito y cobro', async ({ page }) => {
    // Limpiar BD antes del test? E2E corre sobre la DB local pero no la limpia automaticamente aca.
    // Usar env vars (fallback por defecto a lo que habia localmente si no estan seteadas, util para devs locales)
    const testEmail = process.env.TEST_EMPLOYEE_EMAIL || 'empleado@alverde.local';
    const testPass = process.env.TEST_EMPLOYEE_PASSWORD || 'empleado123';
    const testProduct = process.env.TEST_PRODUCT_NAME || 'almendra';

    // 1. Ir a la raiz y asegurar que el login carga
    await page.goto('/');
    
    // Fallar si no aparece el boton Ingresar
    const loginBtn = page.locator('button', { hasText: /Ingresar/i });
    await expect(loginBtn).toBeVisible({ timeout: 5000 });
    
    // 2. Realizar login
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPass);
    await loginBtn.click();
    
    await expect(page).toHaveURL(/\/pos\.html(?:$|[?#])/, { timeout: 10000 });
    
    // 3. Validar carga del POS
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

    // 3.5 Asignar la caja local sembrada si este navegador todavía no tiene una.
    const useRegister = page.getByRole('button', { name: /Usar esta caja/i });
    if (await useRegister.isVisible()) {
      await page.getByLabel('Caja').selectOption({ label: 'Caja E2E (Central)' });
      await useRegister.click();
    }

    // Abrir el turno requerido para vender.
    const btnAbrirTurno = page.locator('button', { hasText: /Abrir turno/i });
    await expect(btnAbrirTurno).toBeVisible({ timeout: 5000 });
    await btnAbrirTurno.click();
    await expect(btnAbrirTurno).toBeHidden({ timeout: 5000 });
    
    // 4. Buscar un producto real
    const searchInput = page.getByLabel(/código o nombre del producto/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill(testProduct);
    
    // Esperar resultados de la busqueda
    const resultItem = page.locator('li').filter({ hasText: new RegExp(testProduct, "i") }).first();
    await expect(resultItem).toBeVisible({ timeout: 5000 });
    
    // 5. Agregar al carrito
    await resultItem.click();
    
    // Validar que se agrego al carrito (subtotal visible)
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
    
    // Esperamos mensaje de exito (la app limpia el carrito despues de la venta)
    await expect(btnConfirmar).toBeHidden({ timeout: 5000 });

    // 7. Verificacion E2E Real: Validar que la venta esta en IndexedDB (Offline)
    const offlineSales = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const req = window.indexedDB.open("alverde-offline");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const close = () => db.close();
          if (!db.objectStoreNames.contains("operations")) {
            close();
            resolve([]);
            return;
          }
          const tx = db.transaction("operations", "readonly");
          const store = tx.objectStore("operations");
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            const result = getAllReq.result;
            close();
            resolve(result);
          };
          getAllReq.onerror = () => {
            const error = getAllReq.error;
            close();
            reject(error);
          };
          tx.onabort = () => {
            const error = tx.error;
            close();
            reject(error);
          };
          tx.onerror = () => {
            const error = tx.error;
            close();
            reject(error);
          };
        };
      });
    });

    expect(offlineSales).toBeInstanceOf(Array);
    const saleOps = (offlineSales as any[]).filter(op => op.kind === 'sale');
    expect(saleOps.length).toBeGreaterThan(0);
    
    const lastSale = saleOps[saleOps.length - 1];
    expect(lastSale).toBeDefined();
    expect(lastSale.payload).toBeDefined();
    expect(lastSale.payload.items).toBeDefined();
    expect(lastSale.payload.items.length).toBeGreaterThan(0);
    
    // Ademas, podriamos validar que la venta este en la base si habia red...
    // Pero como la DB local esta activa y Playwright la usa, Supabase se va a sincronizar automaticamente.
  });
});
