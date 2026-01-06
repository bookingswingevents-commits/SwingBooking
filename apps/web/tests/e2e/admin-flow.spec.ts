import { test, expect } from "@playwright/test";

async function login(page, email, password) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(password);
  await page.getByRole("button", { name: /connecter|connexion|se connecter/i }).click();
  await page.waitForURL(/(dashboard|admin)/, { timeout: 15000 });
}

test.describe("Admin flow", () => {
  test("Admin login", async ({ page }) => {
    await login(page, "admin@test.com", "Test1234!");
    await expect(page).toHaveURL(/admin/);
  });

  test("Admin new request loads", async ({ page }) => {
    await login(page, "admin@test.com", "Test1234!");
    await page.goto("/admin/requests/new");
    await expect(page.locator("body")).not.toContainText("Erreur");
  });

  test("Admin can submit request form (if structured)", async ({ page }) => {
    await login(page, "admin@test.com", "Test1234!");
    await page.goto("/admin/requests/new");
    const titleInput = page.locator("input[name='title'], input[placeholder*='titre']");
    if (await titleInput.count()) {
      await titleInput.first().fill("Test Booking");
    }
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const d = date.toISOString().slice(0, 10);
    const dateInput = page.locator("input[type='date']");
    if (await dateInput.count()) {
      await dateInput.first().fill(d);
    }
    const submitBtn = page.getByRole("button", { name: /Créer|Submit|Créer une demande/i });
    if (await submitBtn.count()) {
      await submitBtn.click();
    }
    await expect(page.locator("body")).not.toContainText("Erreur");
  });
});
