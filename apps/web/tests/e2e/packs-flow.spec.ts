import { test, expect } from "@playwright/test";

async function login(page, email, password) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(password);
  await page.getByRole("button", { name: /connecter|connexion|se connecter/i }).click();
  await page.waitForURL(/(dashboard|venue)/, { timeout: 15000 });
}

test.describe("Packs", () => {
  test("Dashboard shows correct plan for venue", async ({ page }) => {
    await login(page, "venue@test.com", "Test1234!");
    await page.goto("/dashboard");
    await expect(page.locator("body")).not.toContainText("Erreur");
    await expect(page.locator("body")).toContainText(/Free|Starter|Pro|Premium/i);
  });
});
