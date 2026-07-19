import { test, expect } from './fixtures';

test('user can create, edit and delete an action', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Actions$/ })
    .click();

  const view = page.locator('pspf-actions-view');
  await expect(view.getByRole('heading', { name: 'Action tracker' })).toBeVisible();
  await expect(view.locator('p.empty')).toContainText('No actions recorded');

  await view.getByLabel('Title').fill('Roll out MFA to all admins');
  await view.getByLabel('Type').selectOption('remediation');
  await view.getByLabel('Status').selectOption('in-progress');
  await view.getByLabel('Due').fill('2020-01-01'); // past date for overdue
  await view.getByRole('button', { name: 'Add action' }).click();

  const item = view.locator('li.action').first();
  await expect(item).toContainText('Roll out MFA');
  await expect(item).toHaveAttribute('data-overdue', 'true');
  await expect(item.getByRole('button', { name: 'Open' })).toBeVisible();

  // Mark as done — overdue flag should clear
  await item.getByRole('button', { name: 'Open' }).click();
  await expect(item.getByRole('button', { name: 'Close' })).toBeVisible();
  await item.getByRole('button', { name: 'Edit' }).click();
  await item.getByLabel('Status').selectOption('done');
  await item.getByRole('button', { name: 'Save' }).click();
  await expect(item).toHaveAttribute('data-overdue', 'false');

  page.once('dialog', (d) => void d.accept());
  await item.getByRole('button', { name: 'Delete' }).click();
  await expect(view.locator('p.empty')).toContainText('No actions recorded');
});
