import { Page, expect } from '@playwright/test';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required env var ${key}`);
  }
  return val;
}

async function loginGeneric(page: Page, email: string, password: string) {
  await page.goto('/login');
  const logoutBtn = page.getByRole('button', { name: /^Se déconnecter$/i });
  if (await logoutBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await logoutBtn.click();
    await page.waitForURL(/login/, { timeout: 5000 }).catch(() => {});
  }

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/mot de passe|password/i).fill(password);
  await page.locator('form').getByRole('button', { name: /^Se connecter$/i }).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page).not.toHaveURL(/\/login/);
}

export async function loginAsAdmin(page: Page) {
  const email = requireEnv('E2E_ADMIN_EMAIL');
  const password = requireEnv('E2E_ADMIN_PASSWORD');
  await loginGeneric(page, email, password);
}

export async function loginAsVenue(page: Page) {
  const email = requireEnv('E2E_VENUE_EMAIL');
  const password = requireEnv('E2E_VENUE_PASSWORD');
  await loginGeneric(page, email, password);
}

export async function loginAsArtist(page: Page) {
  const email = requireEnv('E2E_ARTIST_EMAIL');
  const password = requireEnv('E2E_ARTIST_PASSWORD');
  await loginGeneric(page, email, password);
}
