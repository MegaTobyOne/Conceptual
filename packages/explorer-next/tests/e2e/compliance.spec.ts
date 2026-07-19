import { test, expect } from './fixtures';

test('user can set compliance state and add evidence', async ({ page }) => {
  // Use a fresh origin per test run by clearing IDB before navigation.
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  // Open a requirement via requirements list view
  const home = page.locator('pspf-home-view');
  await expect(home).toBeVisible();
  await home
    .getByRole('link', { name: /Governance/ })
    .first()
    .click();

  const reqsView = page.locator('pspf-requirements-view');
  await expect(reqsView).toBeVisible({ timeout: 10000 });
  await reqsView.getByRole('link').first().click();
  const reqView = page.locator('pspf-requirement-view');
  await expect(reqView).toBeVisible();

  const editor = reqView.locator('pspf-compliance-editor');
  await expect(editor.getByRole('heading', { name: 'Update compliance' })).toBeVisible();

  // Pick "Fully implemented".
  await editor.getByRole('radio', { name: 'Fully implemented', exact: true }).check();

  // Save a note and ensure it persists across status changes.
  await editor.locator('textarea').fill('Initial implementation evidence captured');
  await editor.getByRole('button', { name: 'Save notes' }).click();
  await editor.getByRole('radio', { name: 'Risk-managed', exact: true }).check();
  await expect(editor.locator('textarea')).toHaveValue('Initial implementation evidence captured');

  // Header badge should now reflect the current state.
  await expect(reqView.locator('header pspf-compliance-badge')).toContainText('Risk-managed');

  // History should include the transition from fully implemented to risk-managed.
  await expect(editor).toContainText('Fully implemented → Risk-managed');

  // Go back to requirements list and reopen to add evidence
  await page.goBack();
  const reqsViewAfter = page.locator('pspf-requirements-view');
  await expect(reqsViewAfter).toBeVisible();
  await reqsViewAfter.getByRole('link').first().click();
  await editor.getByLabel('Evidence value').fill('https://example.gov.au/policy');
  await editor.getByRole('button', { name: 'Add' }).click();
  await expect(editor.locator('ul.evidence li')).toContainText('https://example.gov.au/policy');
});
