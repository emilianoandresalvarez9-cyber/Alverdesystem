import { test, expect } from "@playwright/test";

test("Empleado puede ingresar, fraccionar y ajustar stock desde Stock", async ({ page }) => {
  const testEmail = process.env.TEST_EMPLOYEE_EMAIL || "empleado@alverde.local";
  const testPass = process.env.TEST_EMPLOYEE_PASSWORD || "empleado123";

  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(testEmail);
  await page.getByLabel("Contraseña").fill(testPass);
  await page.getByRole("button", { name: /Ingresar/i }).click();
  await expect(page).toHaveURL(/\/pos\.html(?:$|[?#])/);

  await page.getByRole("link", { name: "Stock" }).click();
  await expect(page).toHaveURL(/\/stock\.html(?:$|[?#])/);
  await expect(page.getByRole("heading", { name: "Ingreso rápido" })).toBeVisible();

  const sourceLot = page.getByRole("row", { name: /Lenteja E2E.*Granel E2E/ });
  await expect(sourceLot).toBeVisible();
  // Todas las acciones del lote están en «Más acciones» (la que corresponde además va a la vista).
  const lotAction = async (name: string) => {
    await sourceLot.getByRole("button", { name: "Más acciones para Lenteja E2E" }).click();
    await page.getByRole("group", { name: "Más acciones para Lenteja E2E" }).getByRole("button", { name }).click();
  };
  await lotAction("Fraccionar");
  await page.getByLabel("Cantidad de bolsitas generadas").fill("2");
  await page.getByRole("button", { name: "Confirmar fraccionamiento" }).click();
  await expect(page.getByRole("heading", { name: "Fraccionamiento de mercadería" })).toBeHidden();

  await lotAction("Ajustar");
  await expect(page.getByRole("heading", { name: "Ajuste de stock: Lenteja E2E" })).toBeVisible();
  await page.getByLabel("Ajuste de inventario (error de conteo)").check({ force: true });
  await page.getByLabel("Agregar faltante").check({ force: true });
  await page.getByLabel("Cantidad a agregar").fill("25");
  await page.getByLabel("Motivo obligatorio").fill("Conteo físico E2E");
  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await page.getByRole("button", { name: "Confirmar movimiento" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Guardado en este dispositivo" })).toContainText("pendiente de sincronización");
  await expect(page.locator(".conexion .conexion__largo")).toHaveText("Sin conexión · 1 operación pendiente");
  await expect(sourceLot).toContainText("825 / 1.000 g");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.context().setOffline(false);
  await expect(page.locator(".conexion .conexion__largo")).toHaveText("Conectado", { timeout: 15000 });
  await expect(sourceLot).toContainText("825 / 1.000 g");

  await page.getByLabel("Escanear código de barras").fill("7790000000008");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("Lenteja E2E", { exact: false }).last()).toBeVisible();
  await page.getByLabel("Cantidad a ingresar").fill("2");
  await page.getByRole("button", { name: "Ingresar lote" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ingreso sincronizado correctamente" }))
    .toContainText("Ingreso sincronizado correctamente");
});

