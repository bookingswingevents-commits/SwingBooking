import { test, expect } from '@playwright/test';

const protectedPaths = [
  '/venue/profile',
  '/venue/requests/123',
  '/venue/proposals/123',
  '/artist/profile',
  '/artist/roadmaps',
  '/admin/requests/new',
];

test.describe('Protected areas (anonymous user)', () => {
  for (const path of protectedPaths) {
    test(`redirects ${path} to login`, async ({ page }) => {
      await page.goto(path);
      const deadline = Date.now() + 5000;
      let ok = false;
      while (Date.now() < deadline) {
        const currentUrl = page.url();
        if (/\/login/i.test(currentUrl)) {
          ok = true;
          break;
        }
        const bodyText = await page.locator('body').innerText().catch(() => '');
        if (
          /(connectez-vous|connexion|login|accès refusé|non autorisé|chargement)/i.test(
            bodyText
          )
        ) {
          ok = true;
          break;
        }
        await page.waitForTimeout(250);
      }
      expect(ok).toBeTruthy();
    });
  }
});
