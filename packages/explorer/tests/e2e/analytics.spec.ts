import { test, expect } from './fixtures';

test('analytics view renders KPIs from the live store', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  // Seed a risk and an overdue action via the UI
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Risks$/ })
    .click();
  const risksView = page.locator('pspf-risks-view');
  await risksView.getByLabel('Title').fill('Phishing wave');
  await risksView.getByLabel('Likelihood').selectOption('5');
  await risksView.getByLabel('Impact').selectOption('5');
  await risksView.getByRole('button', { name: 'Add risk' }).click();
  await expect(risksView.locator('li.risk').first()).toBeVisible();

  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Actions$/ })
    .click();
  const actionsView = page.locator('pspf-actions-view');
  await actionsView.getByLabel('Title').fill('Patch endpoints');
  await actionsView.getByLabel('Status').selectOption('in-progress');
  await actionsView.getByLabel('Due').fill('2020-01-01');
  await actionsView.getByRole('button', { name: 'Add action' }).click();
  await expect(actionsView.locator('li.action').first()).toBeVisible();

  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Analytics$/ })
    .click();
  const view = page.locator('pspf-analytics-view');
  await expect(view.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(view.locator('[data-kpi="open-risks"]')).toHaveText('1');
  await expect(view.locator('[data-kpi="overdue-actions"]')).toHaveText('1');
  await expect(view.locator('[data-kpi="risks-extreme"]')).toHaveText('1');
});
