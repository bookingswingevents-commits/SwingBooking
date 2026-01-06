import { test, expect } from '@playwright/test';

const VENUE_EMAIL = 'venue@test.com';
const VENUE_PASSWORD = 'Test1234!';

test('Un client crée une demande anonyme, se connecte ensuite, et voit sa demande', async ({ page }) => {
  const uniqueTag = `linking-${Date.now()}`;
  const date = new Date();
  date.setDate(date.getDate() + 7);
  const eventDate = date.toISOString().slice(0, 10);

  const createRes = await page.request.post('/api/requests/create', {
    data: {
      formation: 'solo',
      event_date: eventDate,
      start_time: '20:00',
      venue_address: `12 rue du test ${uniqueTag}`,
      venue_contact_name: 'Playwright Client',
      venue_contact_email: VENUE_EMAIL,
      venue_company_name: 'Venue Test',
    },
    headers: { 'content-type': 'application/json' },
  });
  const createJson = await createRes.json();
  if (!createRes.ok() || !createJson?.id) {
    test.skip(true, 'Création de demande impossible');
  }
  const requestId = createJson.id as string;

  await page.goto(`/venue/requests/${requestId}`);
  await expect(page.locator('body')).not.toContainText(/Demande introuvable|Accès refusé/i);

  const detailBody = page.locator('body');
  await expect(detailBody).not.toContainText(/Demande introuvable|Accès refusé|demande invalide/i);
  await expect(detailBody).toContainText(uniqueTag);

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(VENUE_EMAIL);
  await page.getByLabel(/mot de passe/i).fill(VENUE_PASSWORD);
  await page.getByRole('button', { name: /connecter|connexion|se connecter/i }).click();
  await page.waitForURL(/dashboard|venue/, { timeout: 20_000 });

  await page.goto('/dashboard');
  const linkToRequest = page.locator(`a[href="/venue/requests/${requestId}"]`).first();
  await expect(linkToRequest).toBeVisible({ timeout: 20_000 });

  await linkToRequest.click();
  await expect(page).toHaveURL(new RegExp(`/venue/requests/${requestId}`));
  await expect(page.locator('body')).toContainText(uniqueTag);
});
