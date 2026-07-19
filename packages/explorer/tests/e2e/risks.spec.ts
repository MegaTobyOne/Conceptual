import { test, expect } from './fixtures';

test('user can create, edit and delete a risk', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Risks$/ })
    .click();

  const view = page.locator('pspf-risks-view');
  await expect(view.getByRole('heading', { name: 'Risk register' })).toBeVisible();
  await expect(view.locator('p.empty')).toContainText('No risks recorded');

  // Create
  await view.getByLabel('Title').fill('Outdated patching cadence');
  await view.getByLabel('Likelihood').selectOption('4');
  await view.getByLabel('Impact').selectOption('5');
  await view.getByLabel('Status').selectOption('open');
  await view.getByRole('button', { name: 'Add risk' }).click();

  const item = view.locator('li.risk').first();
  await expect(item).toContainText('Outdated patching cadence');
  await expect(item).toHaveAttribute('data-band', 'extreme'); // 4*5 = 20
  await expect(item.getByRole('button', { name: 'Open' })).toBeVisible();

  // Edit (lower likelihood to bring band down)
  await item.getByRole('button', { name: 'Open' }).click();
  await expect(item.getByRole('button', { name: 'Close' })).toBeVisible();
  await item.getByRole('button', { name: 'Edit' }).click();
  await item.getByLabel('Likelihood').selectOption('2');
  await item.getByRole('button', { name: 'Save' }).click();
  await expect(item).toHaveAttribute('data-band', 'high'); // 2*5 = 10

  // Delete
  page.once('dialog', (d) => void d.accept());
  await item.getByRole('button', { name: 'Delete' }).click();
  await expect(view.locator('p.empty')).toContainText('No risks recorded');
});
