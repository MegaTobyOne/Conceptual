import { test, expect } from './fixtures';

test('user can create, edit and delete tags', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Tags$/ })
    .click();

  const view = page.locator('pspf-tags-view');
  await expect(view.getByRole('heading', { name: 'Tags' })).toBeVisible();
  await expect(view.locator('p.empty')).toContainText('No tags yet');

  // Create
  await view.getByLabel('Label').fill('Quarterly review');
  await view.getByLabel('Priority').selectOption('2');
  await view.getByRole('button', { name: 'Add tag' }).click();

  const row = view.locator('li.tag').first();
  await expect(row).toContainText('Quarterly review');
  await expect(row).toContainText('P2');

  // Edit
  await row.getByRole('button', { name: 'Edit' }).click();
  await row.locator('input[type="text"]').fill('Quarterly compliance');
  await row.getByRole('button', { name: 'Save' }).click();
  await expect(row).toContainText('Quarterly compliance');

  // Delete (confirm dialog)
  page.once('dialog', (d) => void d.accept());
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(view.locator('p.empty')).toContainText('No tags yet');
});
