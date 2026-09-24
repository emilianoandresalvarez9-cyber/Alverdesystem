const fs = require('fs');
let c = fs.readFileSync('e2e/sale.spec.ts', 'utf8');

c = c.replace(`    await page.waitForTimeout(3000);
    await page.goto('/pos.html');`, `    // Esperamos redirección automática
    await page.waitForURL('**/pos.html', { timeout: 10000 });`);

const checkDb = `
    // Esperamos mensaje de éxito (la app limpia el carrito después de la venta)
    await expect(btnConfirmar).toBeHidden({ timeout: 5000 });

    // 7. Verificación E2E Real: Validar que la venta está en IndexedDB (Offline)
    const offlineSalesCount = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const req = window.indexedDB.open("alverde-pos-db");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("offline_sales")) {
            resolve(0);
            return;
          }
          const tx = db.transaction("offline_sales", "readonly");
          const store = tx.objectStore("offline_sales");
          const countReq = store.count();
          countReq.onsuccess = () => resolve(countReq.result);
          countReq.onerror = () => reject(countReq.error);
        };
      });
    });

    expect(offlineSalesCount).toBeGreaterThan(0);
`;

c = c.replace(`    // Esperamos mensaje de Ǹxito (la app limpia el carrito despuǸs de la venta)
    await expect(btnConfirmar).toBeHidden({ timeout: 3000 });`, checkDb);

c = c.replace(`    // Esperamos mensaje de éxito (la app limpia el carrito después de la venta)
    await expect(btnConfirmar).toBeHidden({ timeout: 3000 });`, checkDb);

fs.writeFileSync('e2e/sale.spec.ts', c, 'utf8');
