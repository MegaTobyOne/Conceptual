import { test, expect } from './fixtures';

test('user can build a filter and save/load/delete a view', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Saved views$/ })
    .click();

  const view = page.locator('pspf-saved-views-view');
  await expect(view.getByRole('heading', { name: 'Saved views' })).toBeVisible();

  // Apply a domain filter
  await view.getByLabel('Domain').selectOption('risk');
  // Result count text
  await expect(view.locator('h3', { hasText: /^Results/ })).toBeVisible();

  // Save the view
  await view.getByLabel('Name').fill('Risk only');
  await view.getByRole('button', { name: 'Save view' }).click();

  const savedItem = view.locator('ul.saved li').first();
  await expect(savedItem).toContainText('Risk only');
  await expect(savedItem).toContainText('domain=risk');

  // Reset filters then load the saved view
  await view.getByRole('button', { name: 'Reset' }).click();
  await expect(view.getByLabel('Domain')).toHaveValue('');
  await savedItem.getByRole('button', { name: 'Open' }).click();
  await savedItem.getByRole('button', { name: 'Load' }).click();
  await expect(view.getByLabel('Domain')).toHaveValue('risk');

  // Delete (confirm)
  page.once('dialog', (d) => void d.accept());
  await savedItem.getByRole('button', { name: 'Close' }).click();
  await savedItem.getByRole('button', { name: 'Open' }).click();
  await savedItem.getByRole('button', { name: 'Delete' }).click();
  await expect(view.locator('p.empty', { hasText: 'No saved views yet' })).toBeVisible();
});
