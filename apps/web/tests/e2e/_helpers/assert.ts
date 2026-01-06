import { Page, expect } from '@playwright/test';

export async function expectProtected(page: Page, url: string) {
  await page.goto(url);
  const deadline = Date.now() + 5000;
  let lastBody = '';

  while (Date.now() < deadline) {
    const currentUrl = page.url();
    if (/\/(login|auth)/i.test(currentUrl)) return;

    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (bodyText) lastBody = bodyText;

    if (
      /(connexion|login|accès refusé|non autorisé|unauthorized|connectez-vous|connecte-toi)/i.test(
        bodyText
      )
    ) {
      return;
    }

    const hasLoginLink = await page
      .getByRole('link', { name: /se connecter/i })
      .first()
      .isVisible()
      .catch(() => false);
    const hasPrompt = await page
      .getByText(/connectez-vous|connecte-toi/i)
      .first()
      .isVisible({ timeout: 300 })
      .catch(() => false);
    if (hasLoginLink && hasPrompt) return;

    await page.waitForTimeout(250);
  }

  throw new Error(
    `Page not protected: url=${page.url()} snippet=${(lastBody || '').slice(0, 200)}`
  );
}

export async function expectToast(page: Page, text: RegExp) {
  await expect(page.getByText(text)).toBeVisible({ timeout: 8000 });
}
