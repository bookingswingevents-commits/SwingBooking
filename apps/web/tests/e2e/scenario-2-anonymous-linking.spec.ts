import { test, expect } from '@playwright/test';
import { createAnonymousRequest } from './_helpers/request';
import { loginAsVenue } from './_helpers/auth';

test.describe.configure({ mode: 'serial' });

test('Scenario 2 — Anonymous request is visible after login', async ({ page }) => {
  const requestId = await createAnonymousRequest(page);

  await loginAsVenue(page);
  await page.goto('/dashboard');
  await page.goto(`/venue/requests/${requestId}`);

  await expect(page.getByRole('heading', { name: /traitement de la demande/i })).toBeVisible({
    timeout: 10_000,
  });

  // Soft check découverte : bouton modification désactivé ou message
  const changeBtn = page.getByRole('button', { name: /modification/i });
  const disabled = (await changeBtn.count()) ? await changeBtn.isDisabled() : false;
  const hasMsg =
    (await page.getByText(/découverte|discovery|pas de modification/i).count()) > 0;
  if (!disabled && !hasMsg) {
    test.info().annotations.push({ type: 'note', description: 'No discovery flag visible' });
  }
});
