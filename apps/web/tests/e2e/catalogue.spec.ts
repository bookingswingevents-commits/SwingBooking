import { test, expect } from '@playwright/test';

test.describe('Catalogue & formats', () => {
  test('API formats returns data or fallback', async ({ request }) => {
    const res = await request.get('/api/formats');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(Array.isArray(json)).toBeTruthy();
    expect(json.length).toBeGreaterThan(0);
  });

  test('catalogue page renders cards', async ({ page }) => {
    await page.goto('/catalogue');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Catalogue');
    const cards = page.locator('div').filter({ hasText: 'Demander' });
    await expect(cards.first()).toBeVisible();
  });
});
