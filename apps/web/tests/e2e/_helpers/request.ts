import { Page, expect } from '@playwright/test';

type Format = { id: number };

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required env var ${key}`);
  }
  return val;
}

export async function createAnonymousRequest(page: Page): Promise<string> {
  // Récupère un format disponible
  const res = await page.request.get('/api/formats', { failOnStatusCode: false });
  const formats = ((await res.json()) as Format[]) ?? [];
  const formatId = formats[0]?.id;
  if (!formatId) throw new Error('No format available for request creation');

  await page.goto(`/request/new?format=${formatId}`);

  // Attente formulaire
  const heading = page.getByRole('heading', {
    name: /demande de booking|nouvelle demande|demande/i,
  });
  const submitBtn = page.getByRole('button', { name: /envoyer la demande/i });
  await Promise.race([heading.waitFor({ timeout: 5000 }).catch(() => null), submitBtn.waitFor({ timeout: 5000 }).catch(() => null)]);

  const today = new Date();
  const inFive = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
  const dateStr = inFive.toISOString().slice(0, 10);

  const fillIfExists = async (locator: ReturnType<Page['getByLabel']>, value: string) => {
    if (await locator.count()) {
      await locator.first().fill(value);
    }
  };

  // Champs principaux
  await fillIfExists(page.getByLabel(/date de l’événement|date/i), dateStr);
  await fillIfExists(page.getByLabel(/heure/i), '20:00');

  // Formation : select ou bouton
  const formationSelect = page.getByLabel(/formation/i);
  if (await formationSelect.count()) {
    await formationSelect.first().selectOption({ value: 'solo' }).catch(async () => {
      await formationSelect.first().selectOption({ label: /solo/i }).catch(() => {});
    });
  } else {
    const soloRadio =
      (await page.getByRole('radio', { name: /^solo$/i }).count())
        ? page.getByRole('radio', { name: /^solo$/i }).first()
        : null;
    const soloButton =
      (await page.getByRole('button', { name: /^solo$/i }).count())
        ? page.getByRole('button', { name: /^solo$/i }).first()
        : null;
    if (soloRadio) {
      await soloRadio.click({ force: true });
    } else if (soloButton) {
      await soloButton.click({ force: true });
    }
  }

  await fillIfExists(
    page.getByLabel(/adresse de l’établissement|adresse/i),
    '12 rue de test, 75000 Paris'
  );
  await fillIfExists(page.getByLabel(/contact établissement|contact/i), 'E2E Test Venue');
  await fillIfExists(page.getByLabel(/^email$/i), requireEnv('E2E_VENUE_EMAIL'));

  // Occurrence 1 (date déjà liée mais on la renforce si le champ existe)
  const occDate = page.getByLabel(/^Date$/i).first();
  if (await occDate.count()) {
    await occDate.fill(dateStr);
  }

  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes('/api/requests/create') && resp.ok(), {
      timeout: 15_000,
    }),
    submitBtn.click(),
  ]);

  // Essayer d'extraire l'id directement
  const extractId = (u: string) => u.match(/requests\/([^/?#]+)/)?.[1] ?? null;
  let requestId = extractId(page.url());

  if (!requestId) {
    const seeBtn = page.getByRole('button', { name: /voir la demande/i }).first();
    if (await seeBtn.count()) {
      await Promise.all([page.waitForURL('**/requests/**'), seeBtn.click()]);
      requestId = extractId(page.url());
    }
  }

  if (!requestId) {
    throw new Error(`Request ID not found after creation (url=${page.url()})`);
  }
  return requestId;
}
