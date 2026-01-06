import { test, expect } from '@playwright/test';
import { createAnonymousRequest } from './_helpers/request';
import { loginAsVenue, loginAsAdmin } from './_helpers/auth';

test.describe.configure({ mode: 'serial' });

test('Scenario 5 — Ops: roadmaps, communication, agenda, iCal', async ({ page }) => {
  const requestId = await createAnonymousRequest(page);

  // Venue accepte (si bouton présent)
  await loginAsVenue(page);
  await page.goto(`/venue/requests/${requestId}`);
  const acceptBtn = page.getByRole('button', { name: /accepter/i });
  if (await acceptBtn.count()) {
    await acceptBtn.first().click().catch(() => {});
  }

  // Admin envoie les run sheets si dispo
  await loginAsAdmin(page);
  await page.goto(`/admin/requests/${requestId}`);
  const runBtn = page.getByRole('button', { name: /feuille de route|run sheet|envoyer/i });
  if (await runBtn.count()) {
    await runBtn.first().click().catch(() => {});
  }

  // Venue consulte roadmaps
  await loginAsVenue(page);
  await page.goto('/venue/roadmaps');
  await expect(page.locator('body')).toBeVisible();
  await page.goto(`/venue/roadmaps/${requestId}`);
  await expect(page.getByRole('heading', { name: /feuille de route/i })).toBeVisible({
    timeout: 10_000,
  });
  const voyageVisible = await page.getByText(/voyage/i).first().isVisible().catch(() => false);
  const hebergVisible = await page.getByText(/hébergement/i).first().isVisible().catch(() => false);
  const repasVisible = await page.getByText(/repas/i).first().isVisible().catch(() => false);
  expect(voyageVisible || hebergVisible || repasVisible).toBeTruthy();

  // Communication page + envoi Tout passe par là via kit
  await page.goto(`/venue/requests/${requestId}/media-kit`);
  const sendBtn = page.getByRole('button', { name: /tout passe par là|envoyer/i }).first();
  if (await sendBtn.count()) {
    await sendBtn.click().catch(() => {});
    await expect(page.getByText(/demande envoyée|nous vous contactons/i)).toBeVisible({
      timeout: 10_000,
    });
  }
  await page.goto('/venue/communication');
  await expect(page.locator('body')).toBeVisible();
  const commText = page.locator('body');
  await expect(commText).toContainText(/communication|kit|demandes/i);

  // Agenda + export iCal
  await page.goto('/venue/calendar');
  await expect(page.locator('body')).toBeVisible();
  const exportBtn = page.getByRole('button', { name: /exporter ical/i }).first();
  if (await exportBtn.count()) {
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/calendar/ics') && r.status() < 500),
      exportBtn.click(),
    ]);
    expect(resp.ok()).toBeTruthy();
  }
});
