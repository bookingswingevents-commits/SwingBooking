import { test, expect } from '@playwright/test';

test.describe('Auth & roles', () => {
  test('signup page renders', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Créer un compte');
    await expect(page.getByText('Email')).toBeVisible();
    await expect(page.getByText('Mot de passe')).toBeVisible();
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Connexion');
    await expect(page.getByText('Email')).toBeVisible();
    await expect(page.getByText('Mot de passe')).toBeVisible();
  });

  test('protected routes redirect to login when anonymous', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
