import { test, expect } from '@playwright/test';
import { expectProtected } from './_helpers/assert';

const publicPages = ['/', '/catalogue', '/how-it-works', '/packs'];
const protectedPages = ['/dashboard', '/venue/calendar', '/artist/calendar', '/admin/calendar'];

test.describe('Scenario 1 — Smoke + protections', () => {
  for (const path of publicPages) {
    test(`public page ${path} loads`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('body')).toBeVisible();
    });
  }

  for (const path of protectedPages) {
    test(`protected page ${path} requires auth`, async ({ page }) => {
      await expectProtected(page, path);
    });
  }
});
