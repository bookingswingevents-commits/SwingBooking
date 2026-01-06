import { test, expect } from "@playwright/test";

async function login(page, email, password) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(password);
  await page.getByRole("button", { name: /connecter|connexion|se connecter/i }).click();
  await page.waitForURL(/(dashboard|artist)/, { timeout: 15000 });
}

test.describe("Artist flow", () => {
  test("Artist login", async ({ page }) => {
    await login(page, "artist@test.com", "Test1234!");
    await expect(page).toHaveURL(/artist/);
  });

  test("Artist profile loads", async ({ page }) => {
    await login(page, "artist@test.com", "Test1234!");
    await page.goto("/artist/profile");
    await expect(page.locator("form")).toBeVisible();
  });

  test("Artist requests loads", async ({ page }) => {
    await login(page, "artist@test.com", "Test1234!");
    await page.goto("/artist/requests");
    await expect(page.locator("body")).not.toContainText("Erreur");
  });

  test("Artist can save website and sees success", async ({ page }) => {
    await login(page, "artist@test.com", "Test1234!");
    await page.goto("/artist/profile");
    const websiteInput = page.getByLabel(/site internet/i);
    await expect(websiteInput).toBeVisible();
    const uniqueUrl = `https://artist-example-${Date.now()}.test`;
    await websiteInput.fill(uniqueUrl);
    await page.getByRole("button", { name: /enregistrer mon profil/i }).click();
    await expect(page.getByText(/profil artiste mis à jour/i)).toBeVisible({ timeout: 15000 });
  });
});
