import { test, expect } from '@playwright/test';
import { createAnonymousRequest } from './_helpers/request';
import { loginAsAdmin } from './_helpers/auth';

test.describe.configure({ mode: 'serial' });

test('Scenario 3 — Admin sees artists and can invite', async ({ page }) => {
  const requestId = await createAnonymousRequest(page);

  await loginAsAdmin(page);
  await page.goto(`/admin/requests/${requestId}`);

  await expect(page.getByRole('heading', { name: /artistes —/i })).toBeVisible({
    timeout: 10_000,
  });

  const selectButtons = page.getByRole('button', { name: /sélectionner/i });
  const count = await selectButtons.count();
  expect(count, 'Aucun artiste listé pour cette demande').toBeGreaterThan(0);

  const firstSelect = selectButtons.nth(0);
  await firstSelect.click();
  await expect(page.getByRole('button', { name: /désélectionner/i }).first()).toBeVisible({
    timeout: 5000,
  });

  await page.getByRole('button', { name: /envoyer invit/i }).click();

  await expect(
    page.getByText(/proposition envoyée|invitation envoyée|déjà invité/i)
  ).toBeVisible({ timeout: 10_000 });

  // Tolérant : badge invité OU bouton désactivé OU plus de bouton sélection
  const invitedBadge = await page
    .getByText(/proposition envoyée|déjà invité/i)
    .first()
    .isVisible()
    .catch(() => false);
  const disabled = await firstSelect.isDisabled().catch(() => false);
  const stillSelectable = await firstSelect.isVisible().catch(() => false);
  expect(invitedBadge || disabled || !stillSelectable).toBeTruthy();
});
