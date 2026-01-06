import { test, expect } from '@playwright/test';

test.describe('Request creation flow (public entry)', () => {
  test('request/new loads and shows form fields', async ({ page }) => {
    await page.goto('/request/new?format=1');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Demande de prestation');
    const notFound = await page.getByText('Format introuvable.', { exact: false }).isVisible().catch(() => false);
    if (!notFound) {
      await expect(page.getByRole('button', { name: /Envoyer la demande/ })).toBeVisible();
    }
  });
});
