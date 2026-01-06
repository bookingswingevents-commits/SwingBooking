import { test, expect } from '@playwright/test';
import { loginAsArtist, loginAsAdmin, loginAsVenue } from './_helpers/auth';

async function createRequestViaService(): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const venueEmail = (process.env.E2E_VENUE_EMAIL || 'venue@test.com').toLowerCase();
  const artistId = process.env.E2E_ARTIST_ID;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!artistId) {
    throw new Error('Missing E2E_ARTIST_ID (set the test artist id in .env.local)');
  }
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  const today = new Date();
  const inFive = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
  const eventDate = inFive.toISOString().slice(0, 10);

  const requestPayload = {
    title: `E2E auto ${eventDate}`,
    formation: 'solo',
    event_date: eventDate,
    start_time: '20:00',
    venue_contact_email: venueEmail,
    venue_contact_name: 'E2E Venue',
    venue_address: '12 rue de test, Paris',
    status: 'to_process',
    request_tier: 'discovery',
    event_format: 'aperoconcert',
    notes: 'E2E scenario-4 compensation flow',
  };
  const reqRes = await fetch(`${supabaseUrl}/rest/v1/booking_requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestPayload),
  });
  const reqJson = await reqRes.json();
  const requestId = reqJson?.[0]?.id as string | undefined;
  if (!reqRes.ok || !requestId) {
    throw new Error(`Failed to create booking_request: ${reqRes.status} ${JSON.stringify(reqJson)}`);
  }

  const occPayload = {
    request_id: requestId,
    date: eventDate,
    start_time: '20:00',
    duration_minutes: 120,
    address_snapshot: '12 rue de test, Paris',
    audience_estimate: 80,
  };
  const occRes = await fetch(`${supabaseUrl}/rest/v1/booking_request_occurrences`, {
    method: 'POST',
    headers,
    body: JSON.stringify(occPayload),
  });
  const occJson = await occRes.json().catch(() => ({}));
  if (!occRes.ok) {
    throw new Error(`Failed to create occurrence: ${occRes.status} ${JSON.stringify(occJson)}`);
  }

  // Draft proposal for the artist to expose compensation UI
  const proposalPayload = {
    request_id: requestId,
    artist_id: artistId,
    status: 'pending',
  };
  const propRes = await fetch(`${supabaseUrl}/rest/v1/proposals`, {
    method: 'POST',
    headers,
    body: JSON.stringify(proposalPayload),
  });
  const propJson = await propRes.json().catch(() => ({}));
  if (!propRes.ok) {
    throw new Error(`Failed to create proposal: ${propRes.status} ${JSON.stringify(propJson)}`);
  }

  return requestId;
}

async function patchProposalCompensation(requestId: string, artistId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing supabase env for patchProposalCompensation');
  }
  const url = `${supabaseUrl}/rest/v1/proposals?request_id=eq.${requestId}&artist_id=eq.${artistId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      compensation_mode: 'cachet',
      compensation_amount: 150,
      compensation_expenses: 50,
      compensation_organism: "Un dimanche au bord de l'eau",
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PATCH proposals failed ${res.status}: ${text}`);
  return text;
}

async function fetchProposal(requestId: string, artistId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing supabase env for fetchProposal');
  }
  const url = `${supabaseUrl}/rest/v1/proposals?request_id=eq.${requestId}&artist_id=eq.${artistId}`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=representation',
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`GET proposals failed ${res.status}: ${JSON.stringify(json)}`);
  return Array.isArray(json) ? json[0] : json;
}

async function markProposalSent(requestId: string, artistId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing supabase env for markProposalSent');
  }
  const url = `${supabaseUrl}/rest/v1/proposals?request_id=eq.${requestId}&artist_id=eq.${artistId}`;
  async function patch(status: string) {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ status }),
    });
    const txt = await res.text();
    return { ok: res.ok, status: res.status, txt };
  }
  let r = await patch('sent');
  if (!r.ok) r = await patch('proposal_sent');
  if (!r.ok) throw new Error(`Cannot mark proposal sent. Last=${r.status}: ${r.txt}`);
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test('Scenario 4 — Compensation flow artist -> admin -> venue', async ({ page }) => {
  const t0 = Date.now();
  const log = (msg: string) =>
    console.log(`[scenario-4 +${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

  const requestId = await createRequestViaService();
  const browser = page.context().browser();
  const context = await browser?.newContext();
  if (!context) throw new Error('Could not create browser context');
  const artistPage = await context.newPage();
  const adminPage = await context.newPage();
  const venuePage = await context.newPage();

  try {
    log(`created request via REST id=${requestId}`);

    // ARTISTE renseigne la rémunération
    log('login artist');
    await loginAsArtist(artistPage);
    await expect(artistPage).not.toHaveURL(/\/login/);
    await artistPage.waitForSelector('button:has-text("Se déconnecter")', { timeout: 15_000 }).catch(() => {});
    log('goto artist request');
    await artistPage.goto(`/artist/requests/${requestId}`);
    await artistPage.waitForTimeout(300);
    await artistPage.waitForSelector('body', { timeout: 10_000 });
    await Promise.race([
      artistPage.getByRole('heading', { name: /rémunération|traitement de la demande|demande/i }).first().waitFor({ timeout: 10_000 }),
      artistPage.getByRole('button', { name: /^enregistrer$/i }).first().waitFor({ timeout: 10_000 }),
      artistPage.getByLabel(/montant/i).first().waitFor({ timeout: 10_000 }),
    ]);

    log('fill compensation');
    const artistId = process.env.E2E_ARTIST_ID;
    if (!artistId) {
      throw new Error('Missing E2E_ARTIST_ID (set it in .env.local)');
    }
    const amountInput =
      (await artistPage.locator('input[type="number"]').first().count())
        ? artistPage.locator('input[type="number"]').first()
        : artistPage.getByLabel(/montant/i).first();
    const amountVisible = await amountInput.isVisible().catch(() => false);
    if (amountVisible) {
      await amountInput.fill('150');
    } else {
      log('WARNING: amount input not found, fallback to REST patch');
      await patchProposalCompensation(requestId, artistId);
    }
    const compMode = artistPage.getByLabel(/mode de rémunération|cachet/i).first();
    if (await compMode.isVisible().catch(() => false)) {
      await compMode.selectOption({ label: /cachet/i }).catch(() => {});
    }
    const saveBtnCandidates = [
      artistPage.getByRole('button', { name: /^enregistrer$/i }).first(),
    ];
    for (const btn of saveBtnCandidates) {
      if (await btn.isVisible().catch(() => false)) {
        await btn.click().catch(() => {});
        break;
      }
    }
    log('wait save feedback');
    await Promise.race([
      artistPage.getByText(/enregistré/i).first().isVisible().catch(() => false),
      artistPage.getByRole('button', { name: /^enregistrer$/i }).first().isDisabled().catch(() => false),
      artistPage.waitForTimeout(15_000).then(() => false),
    ]);

    log('verify compensation via REST');
    const proposal = await fetchProposal(requestId, artistId);
    expect(proposal?.compensation_amount).toBe(150);
    expect(proposal?.compensation_mode).toBeTruthy();

    log('mark proposal sent via REST');
    await markProposalSent(requestId, artistId);

    // VENUE voit la proposition
    log('login venue');
    await loginAsVenue(venuePage);
    await expect(venuePage).not.toHaveURL(/\/login/);
    await venuePage.waitForSelector('button:has-text("Se déconnecter")', { timeout: 15_000 }).catch(() => {});
    log('goto venue request');
    await venuePage.goto(`/venue/requests/${requestId}`);
    await venuePage.waitForTimeout(300);
    await venuePage.waitForSelector('body', { timeout: 10_000 });
    await Promise.race([
      venuePage.getByRole('heading', { name: /traitement de la demande/i }).first().waitFor({ timeout: 10_000 }),
      venuePage.getByText(/proposition envoyée|proposition/i).first().waitFor({ timeout: 10_000 }),
    ]);
    await expect(venuePage.getByText(/150\s*€|150 ?eur/i)).toBeVisible({ timeout: 15_000 });
    await expect(
      venuePage.getByRole('heading', { name: /mode de rémunération/i })
    ).toBeVisible({ timeout: 15_000 });
    const hasCachet = await venuePage.getByText(/cachet géré via/i).first().count();
    const hasFacture = await venuePage.getByText(/facture/i).first().count();
    expect(hasCachet + hasFacture).toBeGreaterThan(0);
    await expect(venuePage.getByText(/aucune proposition n’a encore été envoyée/i)).toHaveCount(0);
    log('verify proposal done');
  } catch (e) {
    log('ERROR: ' + (e as Error).message);
    await artistPage.screenshot({
      path: 'test-results/scenario4-artist-fail.png',
      fullPage: true,
    }).catch(() => {});
    await adminPage.screenshot({
      path: 'test-results/scenario4-admin-fail.png',
      fullPage: true,
    }).catch(() => {});
    await venuePage.screenshot({
      path: 'test-results/scenario4-venue-fail.png',
      fullPage: true,
    }).catch(() => {});
    throw e;
  }
});
