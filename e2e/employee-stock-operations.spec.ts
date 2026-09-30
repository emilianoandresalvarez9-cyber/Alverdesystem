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
  await expect(page.getByRole("heading", { name: "Ingreso de mercadería" })).toBeVisible();

  const sourceLot = page.getByRole("row", { name: /Lenteja E2E.*Granel E2E/ });
  await expect(sourceLot).toBeVisible();
  await sourceLot.getByRole("button", { name: "Fraccionar" }).click();
  await page.getByLabel("Cantidad de bolsitas generadas").fill("2");
  await page.getByRole("button", { name: "Confirmar Fraccionamiento" }).click();
  await expect(page.getByRole("heading", { name: "Fraccionamiento de Mercadería" })).toBeHidden();

  await sourceLot.getByRole("button", { name: "Ajustar" }).click();
  await page.getByLabel("Tipo de movimiento (RF-57)").selectOption("adjustment");
  await page.getByLabel("Dirección del ajuste").selectOption("add");
  await page.getByLabel("Cantidad a agregar (gram)").fill("25");
  await page.getByLabel("Motivo obligatorio").fill("Conteo físico E2E");
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Confirmar Movimiento" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Guardado en este dispositivo" })).toContainText("pendiente de sincronización");
  await expect(page.locator(".sync-status")).toContainText("1 operación pendiente");
  await expect(sourceLot).toContainText("825 / 1000 gram");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.context().setOffline(false);
  await expect(page.locator(".sync-status")).toContainText("0 operaciones pendientes", { timeout: 15000 });
  await expect(sourceLot).toContainText("825 / 1000 gram");

  await page.getByLabel("Escanear código de barras").fill("7790000000008");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("Lenteja E2E", { exact: false }).last()).toBeVisible();
  await page.getByLabel("Cantidad a ingresar").fill("2");
  await page.getByRole("button", { name: "Ingresar Lote" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Lote ingresado" })).toContainText("Lote ingresado:");
});

