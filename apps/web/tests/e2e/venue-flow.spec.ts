import { test, expect } from "@playwright/test";

async function login(page, email, password) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(password);
  await page.getByRole("button", { name: /connecter|connexion|se connecter/i }).click();
  await page.waitForURL(/(dashboard|venue)/, { timeout: 15000 });
}

test.describe("Venue flow", () => {
  test("Venue login", async ({ page }) => {
    await login(page, "venue@test.com", "Test1234!");
    await expect(page).toHaveURL(/(dashboard|venue)/);
  });

  test("Venue profile page loads", async ({ page }) => {
    await login(page, "venue@test.com", "Test1234!");
    await page.goto("/venue/profile");
    await expect(page.locator("form")).toBeVisible();
  });

  test("Venue requests page loads", async ({ page }) => {
    await login(page, "venue@test.com", "Test1234!");
    await page.goto("/venue/requests");
    await expect(page.locator("body")).not.toContainText("Erreur");
  });
});
