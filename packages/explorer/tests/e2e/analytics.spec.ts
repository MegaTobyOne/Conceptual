import { test, expect } from './fixtures';

test('analytics view renders KPIs from the live store', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  const home = page.locator('pspf-home-view');
  await home
    .getByRole('link', { name: /Governance/ })
    .first()
    .click();
  const requirements = page.locator('pspf-requirements-view');
  await requirements.getByRole('link').first().click();
  const complianceEditor = page.locator('pspf-compliance-editor');
  await complianceEditor.getByRole('radio', { name: 'Fully implemented', exact: true }).check();
  await expect(complianceEditor).toContainText('Status history');

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
  await expect(view.getByRole('heading', { name: 'Recorded changes over time' })).toBeVisible();
  await expect(view.getByRole('group', { name: 'Change history period' })).toBeVisible();
  await expect(
    view.getByText('1 compliance change recorded in the selected period.'),
  ).toBeVisible();
  await expect(view.getByRole('heading', { name: 'Snapshot posture trend' })).toBeVisible();
  await expect(view.getByText('No metric-bearing Core checkpoints are loaded.')).toBeVisible();
  await view.getByRole('button', { name: 'All recorded' }).click();
  await expect(
    view.getByText('1 compliance change recorded in the selected period.'),
  ).toBeVisible();
});
