import { test, expect } from '@playwright/test';
import { loginAsVenue, loginAsArtist, loginAsAdmin } from './_helpers/auth';

async function createRequestWithProposal() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const venueEmail = (process.env.E2E_VENUE_EMAIL || '').toLowerCase();
  const artistId = process.env.E2E_ARTIST_ID;
  if (!supabaseUrl || !key || !venueEmail || !artistId) {
    throw new Error('Missing envs: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_VENUE_EMAIL, E2E_ARTIST_ID');
  }
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  const inFive = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const dateStr = inFive.toISOString().slice(0, 10);
  const reqRes = await fetch(`${supabaseUrl}/rest/v1/booking_requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: `E2E dashboard actions ${Date.now()}`,
      formation: 'solo',
      event_date: dateStr,
      venue_contact_email: venueEmail,
      venue_contact_name: 'E2E Venue',
      venue_address: '12 rue de test, Paris',
      status: 'to_process',
      request_tier: 'discovery',
    }),
  });
  const reqJson = await reqRes.json();
  const requestId = reqJson?.[0]?.id as string | undefined;
  if (!reqRes.ok || !requestId) {
    throw new Error(`Failed to create request: ${reqRes.status} ${JSON.stringify(reqJson)}`);
  }
  await fetch(`${supabaseUrl}/rest/v1/booking_request_occurrences`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      request_id: requestId,
      date: dateStr,
      start_time: '20:00',
      duration_minutes: 120,
      address_snapshot: '12 rue de test, Paris',
    }),
  });
  const propRes = await fetch(`${supabaseUrl}/rest/v1/proposals`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      request_id: requestId,
      artist_id: artistId,
      status: 'proposal_sent',
      compensation_amount: 150,
      compensation_mode: 'cachet',
    }),
  });
  if (!propRes.ok) {
    const txt = await propRes.text();
    throw new Error(`Failed to create proposal: ${propRes.status} ${txt}`);
  }
  return requestId;
}

test.describe('Dashboards actions & agenda shortcuts', () => {
  test('Venue dashboard shows Actions requises for proposal sent', async ({ page }) => {
    const requestId = await createRequestWithProposal();
    await loginAsVenue(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /actions requises/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /voir et répondre/i })).toBeVisible();
    await page.getByRole('link', { name: /voir et répondre/i }).click();
    await expect(page).toHaveURL(new RegExp(requestId));
  });

  test('Artist dashboard exposes agenda shortcut', async ({ page }) => {
    await loginAsArtist(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /agenda/i })).toBeVisible();
  });

  test('Admin dashboard exposes agenda shortcut', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /agenda/i })).toBeVisible();
  });
});
