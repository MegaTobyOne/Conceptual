import { test, expect } from './fixtures';

test('user can log work on a requirement and remove it', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  // Navigate to a requirement (via home → governance requirements list)
  const home = page.locator('pspf-home-view');
  await expect(home).toBeVisible();
  await home.locator('a.card').first().click();

  const reqsView = page.locator('pspf-requirements-view');
  await expect(reqsView).toBeVisible({ timeout: 10000 });
  await reqsView.getByRole('link').first().click();

  const log = page.locator('pspf-work-log');
  await expect(log.getByRole('heading', { name: 'Work log' })).toBeVisible();
  await expect(log.locator('p.empty')).toContainText('No work logged');

  await log.getByLabel('Note').fill('Drafted ISM mapping');
  await log.getByLabel('Effort').fill('2h');
  await log.getByRole('button', { name: 'Log work' }).click();

  const entry = log.locator('li.entry').first();
  await expect(entry).toContainText('Drafted ISM mapping');
  await expect(entry).toContainText('effort: 2h');

  page.once('dialog', (d) => void d.accept());
  await entry.getByRole('button', { name: 'Remove' }).click();
  await expect(log.locator('p.empty')).toContainText('No work logged');
});
