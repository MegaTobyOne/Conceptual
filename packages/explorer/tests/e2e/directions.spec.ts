import { test, expect } from './fixtures';

test('user can create, edit and delete a PSPF direction with linked requirements', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string): Promise<void> => {
          (window as typeof window & { __copiedText?: string }).__copiedText = text;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Directions$/ })
    .click();
  const view = page.locator('pspf-directions-view');
  await expect(view.locator('[data-testid="empty"]')).toBeVisible();

  await view.getByLabel('Reference').fill('PSPF Direction 001-2025');
  await view.getByLabel('Title').fill('Heightened cyber posture');
  await view.getByLabel('Issued').fill('2025-04-01');
  await view.getByRole('combobox', { name: 'Response' }).selectOption('risk-managed');
  await view
    .getByLabel('Description')
    .fill('Move to Active Defence posture for technology domain.');
  await view.getByLabel('Linked requirement IDs', { exact: false }).fill('TECH-1, TECH-2');
  await view.getByLabel('Response notes').fill('Accepted with compensating monitoring.');
  await view.getByLabel('Evidence', { exact: true }).fill('CISO approval in April forum');
  await view.getByRole('button', { name: 'Add direction' }).click();

  const item = view.locator('li.direction').first();
  await expect(item).toBeVisible();
  await expect(item.getByText('PSPF Direction 001-2025')).toBeVisible();
  await expect(item.getByText('Heightened cyber posture')).toBeVisible();

  await expect(item.getByRole('button', { name: 'Open' })).toBeVisible();
  await item.getByRole('button', { name: 'Open' }).click();
  await expect(item.getByRole('button', { name: 'Close' })).toBeVisible();

  await expect(item.getByText('Risk-managed')).toBeVisible();
  await expect(item.getByText('Accepted with compensating monitoring.')).toBeVisible();
  await expect(item.getByText('note: CISO approval in April forum')).toBeVisible();
  await expect(item.getByRole('link', { name: 'TECH-1' })).toBeVisible();
  await expect(item.getByRole('link', { name: 'TECH-2' })).toBeVisible();

  await view.getByLabel('Show').selectOption('yes');
  await expect(view.locator('[data-testid="empty"]')).toBeVisible();
  await view.getByLabel('Show').selectOption('risk-managed');
  await expect(item).toBeVisible();
  await view.getByLabel('Show').selectOption('all');

  // Edit
  await item.getByRole('button', { name: 'Edit' }).click();
  await item.getByLabel('Title').fill('Heightened cyber posture (rev 1)');
  await item.getByRole('combobox', { name: 'Response' }).selectOption('yes');
  await item.getByLabel('Add evidence').fill('Closure note sent to SOC');
  await item.getByRole('button', { name: 'Save' }).click();
  await expect(item.getByText('Heightened cyber posture (rev 1)')).toBeVisible();
  await expect(item.getByText('Dealt with')).toBeVisible();
  await expect(item.getByText('note: Closure note sent to SOC')).toBeVisible();

  await item.getByRole('button', { name: 'Copy summary' }).click();
  await expect(view.getByText('Copied summary.')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { __copiedText?: string }).__copiedText),
    )
    .toContain('Response: Yes');

  // Survives reload
  await page.reload();
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Directions$/ })
    .click();
  await expect(
    page.locator('pspf-directions-view').getByText('Heightened cyber posture (rev 1)'),
  ).toBeVisible();
  await expect(
    page.locator('pspf-directions-view li.direction').first().getByText('Dealt with', {
      exact: true,
    }),
  ).toBeVisible();

  // Delete
  page.once('dialog', (d) => void d.accept());
  const persistedItem = page.locator('pspf-directions-view li.direction').first();
  await persistedItem.getByRole('button', { name: 'Open' }).click();
  await persistedItem.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('pspf-directions-view [data-testid="empty"]')).toBeVisible();
});
