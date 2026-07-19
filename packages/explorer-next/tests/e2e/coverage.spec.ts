import { test, expect } from './fixtures';

test('coverage matrix totals reflect persisted compliance', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  // With nothing recorded, all 218 requirements should be in not-set
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Coverage$/ })
    .click();
  const view = page.locator('pspf-coverage-view');
  await expect(view.getByRole('heading', { name: 'Coverage matrix' })).toBeVisible();
  await expect(view.locator('[data-grand-total]')).toHaveText('218');
  await expect(view.locator('[data-overall-compliant-pct]')).toHaveText('0%');
  await expect(view.locator('[data-total-state="not-set"]')).toHaveText('218');
});
