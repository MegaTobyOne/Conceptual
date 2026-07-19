import { test, expect } from './fixtures';

test('user can export a share package and merge it back, skipping duplicates', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  // Seed a tag
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Tags$/ })
    .click();
  const tagsView = page.locator('pspf-tags-view');
  await tagsView.getByLabel(/Label/i).fill('Shared tag');
  await tagsView.getByRole('button', { name: /Add tag/i }).click();

  // Download share package
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Share$/ })
    .click();
  const view = page.locator('pspf-share-view');
  const downloadPromise = page.waitForEvent('download');
  await view.getByTestId('download-share').click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();

  // Merge same file: should skip duplicates
  await view.getByTestId('merge-file').setInputFiles(path);
  await expect(view.getByRole('status')).toContainText(/skipped/);
  await expect(view.locator('[data-skipped="tags"]')).toHaveText('1');
  await expect(view.locator('[data-added="tags"]')).toHaveText('0');
});

test('share view rejects malformed JSON', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Share$/ })
    .click();
  const view = page.locator('pspf-share-view');
  await view.getByTestId('merge-file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('not json'),
  });
  await expect(view.getByRole('alert')).toBeVisible();
});
