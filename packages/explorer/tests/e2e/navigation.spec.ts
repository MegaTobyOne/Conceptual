import { test, expect } from './fixtures';

test('home view renders all six domains and links to domain pages', async ({ page }) => {
  await page.goto('./');
  const app = page.locator('pspf-app');
  await expect(app).toBeVisible();

  // Wait for store boot + router mount.
  const home = page.locator('pspf-home-view');
  await expect(home.getByRole('heading', { level: 2, name: 'PSPF domains' })).toBeVisible();
  await expect(app).toContainText('OFFICIAL: Sensitive');
  await expect(app).toContainText('TLP:AMBER+STRICT');
  await expect(page.locator('pspf-home-view pspf-breadcrumbs')).toContainText('Home');

  for (const name of ['Governance', 'Information', 'Personnel', 'Physical', 'Risk', 'Technology']) {
    await expect(app.getByRole('link', { name: new RegExp(name) }).first()).toBeVisible();
  }

  // Each domain card has a progress meter starting at 0%.
  await expect(app.getByRole('progressbar')).toHaveCount(6);
  for (const bar of await app.getByRole('progressbar').all()) {
    await expect(bar).toHaveAttribute('aria-valuenow', '0');
  }
});

test('navigates to a domain page and back to home', async ({ page }) => {
  await page.goto('./');
  const home = page.locator('pspf-home-view');
  await expect(home).toBeVisible();
  await home
    .getByRole('link', { name: /Governance/ })
    .first()
    .click();

  // Domain cards now link to the requirements list view
  const reqsView = page.locator('pspf-requirements-view');
  await expect(reqsView).toBeVisible({ timeout: 10000 });
  await expect(reqsView.getByRole('heading', { level: 2 })).toHaveText('Governance');
  await expect(reqsView.locator('pspf-breadcrumbs')).toContainText('Home');
  await expect(reqsView.locator('pspf-breadcrumbs')).toContainText('Governance');

  // First requirement link should navigate to a requirement view.
  await reqsView.getByRole('link').first().click();
  const reqView = page.locator('pspf-requirement-view');
  await expect(reqView).toBeVisible();
  await expect(reqView.locator('pspf-breadcrumbs')).toContainText('Home');
  // Compliance badge defaults to 'Not set' for an untouched requirement.
  await expect(reqView.locator('pspf-compliance-badge')).toContainText('Not set');
});

test('unknown route shows the not-found view', async ({ page }) => {
  await page.goto('./#/no-such-route');
  await expect(page.locator('pspf-not-found-view')).toBeVisible();
});

test('top bar search opens matching PSPF requirements', async ({ page }) => {
  await page.goto('./');
  const app = page.locator('pspf-app');
  const home = page.locator('pspf-home-view');
  await expect(home.getByRole('heading', { level: 2, name: 'PSPF domains' })).toBeVisible();

  await app.getByPlaceholder('Search PSPF...').fill('GOV-001');
  await expect(app.getByRole('listbox', { name: 'Search results' })).toContainText('GOV-001');
  await app
    .getByRole('link', { name: /GOV-001/ })
    .first()
    .click();

  await expect(page).toHaveURL(/#\/requirement\/GOV-001$/);
  await expect(page.locator('pspf-requirement-view')).toContainText('GOV-001');
});

test('requirement view supports previous and next navigation', async ({ page }) => {
  await page.goto('./#/requirement/GOV-001');
  const reqView = page.locator('pspf-requirement-view');
  await expect(reqView).toContainText('GOV-001');
  await expect(reqView.getByTestId('prev-requirement-disabled')).toBeVisible();

  await reqView.getByTestId('next-requirement').click();
  await expect(page).toHaveURL(/#\/requirement\/GOV-002$/);
  await expect(reqView.getByTestId('prev-requirement')).toBeVisible();
});
