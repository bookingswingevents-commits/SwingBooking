import { test, expect } from '@playwright/test';

test.skip(true, 'Replaced by scenario-3-admin-matching.spec.ts');

async function login(page, email, password) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(password);
  await page.getByRole('button', { name: /^Se connecter$/i }).first().click();
  await page.waitForURL(/dashboard|artist|admin/, { timeout: 15000 });
}

test('Admin voit un artiste actif compatible avec la formation', async ({ page, context }) => {
  const unique = `solo-${Date.now()}`;
  const date = new Date();
  date.setDate(date.getDate() + 10);
  const eventDate = date.toISOString().slice(0, 10);
  let stageNameValue = `Artiste sans nom`;

  // 1) Créer une demande via l'API publique create (service role)
  const payload = {
    formation: 'solo',
    event_date: eventDate,
    start_time: '20:00',
    location: null,
    duration_minutes: 120,
    audience_size: 80,
    notes: `Test ${unique}`,
    venue_company_name: 'Test Venue',
    venue_address: '1 rue test',
    venue_contact_name: 'Test Contact',
    venue_contact_email: 'venue@test.com',
  };
  const createRes = await page.request.post('/api/requests/create', {
    data: payload,
    headers: { 'content-type': 'application/json' },
  });
  const createJson = await createRes.json();
  if (!createRes.ok() || !createJson?.id) {
    test.skip(true, 'Impossible de créer une demande pour le test');
  }
  const requestId = createJson.id as string;

  // 2) Artiste : activer profil + formation solo
  const artistPage = await context.newPage();
  await login(artistPage, 'artist@test.com', 'Test1234!');
  await artistPage.goto('/artist/profile');
  const stageNameInput = artistPage.getByLabel(/Nom de scène|Nom d'artiste|Stage name/i).first();
  if (await stageNameInput.count()) {
    stageNameValue = `Artiste Solo ${unique}`;
    await stageNameInput.fill(stageNameValue);
  }
  const soloCheckbox = artistPage.getByLabel(/Solo/);
  if (await soloCheckbox.count()) {
    if (!(await soloCheckbox.isChecked())) {
      await soloCheckbox.check();
    }
  }
  const activeToggle = artistPage.getByLabel(/Actif/i).first();
  if (await activeToggle.count()) {
    if (!(await activeToggle.isChecked())) {
      await activeToggle.check();
    }
  }
  await artistPage
    .getByRole('button', { name: /Enregistrer|Mettre à jour|Sauvegarder/i })
    .click();
  await artistPage
    .getByText(/profil artiste mis à jour/i)
    .first()
    .waitFor({ timeout: 10000 });

  // 3) Admin : voir la demande et la liste artistes
  const adminPage = await context.newPage();
  await login(adminPage, 'admin@test.com', 'Test1234!');
  await adminPage.goto(`/admin/requests/${requestId}`);
  await adminPage.waitForURL(/admin\/requests\//, { timeout: 10000 });
  await adminPage.waitForTimeout(2000);
  await expect(adminPage.getByText('Aucun artiste actif', { exact: false })).toHaveCount(0);
  await expect(adminPage.getByText(stageNameValue, { exact: false }).first()).toBeVisible();
});
