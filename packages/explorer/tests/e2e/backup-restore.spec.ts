import { test, expect } from './fixtures';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

test('backup downloads JSON, restore replaces store contents', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  // Seed a tag so the backup is non-empty
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Tags$/ })
    .click();
  const tagsView = page.locator('pspf-tags-view');
  await tagsView.getByLabel('Label').fill('From original browser');
  await tagsView.getByRole('button', { name: 'Add tag' }).click();
  await expect(tagsView.getByText('From original browser')).toBeVisible();

  // Download backup
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Backup$/ })
    .click();
  const backupView = page.locator('pspf-backup-view');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    backupView.locator('[data-testid="download-backup"]').click(),
  ]);
  const tmpFile = path.join(os.tmpdir(), `pspf-backup-${Date.now()}.json`);
  await download.saveAs(tmpFile);
  const json = JSON.parse(await fs.readFile(tmpFile, 'utf8')) as {
    pspfBackup: string;
    stores: { tags: unknown[] };
  };
  expect(json.pspfBackup).toBe('v1');
  expect(json.stores.tags).toHaveLength(1);

  // Clear all data
  page.once('dialog', (d) => void d.accept());
  await backupView.locator('[data-testid="clear-all"]').click();
  await expect(backupView.getByText('All data cleared.')).toBeVisible();

  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Tags$/ })
    .click();
  await expect(page.locator('pspf-tags-view').getByText('From original browser')).toHaveCount(0);

  // Restore
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Restore$/ })
    .click();
  const restoreView = page.locator('pspf-restore-view');
  await restoreView.locator('[data-testid="restore-file"]').setInputFiles(tmpFile);
  await restoreView.locator('[data-testid="restore-button"]').click();
  await expect(restoreView.getByText('Backup restored successfully.')).toBeVisible();

  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Tags$/ })
    .click();
  await expect(page.locator('pspf-tags-view').getByText('From original browser')).toBeVisible();

  await fs.unlink(tmpFile).catch(() => undefined);
});

test('restore rejects invalid JSON', async ({ page }) => {
  await page.goto('./');
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Restore$/ })
    .click();
  const restoreView = page.locator('pspf-restore-view');
  const tmpFile = path.join(os.tmpdir(), `pspf-bogus-${Date.now()}.json`);
  await fs.writeFile(tmpFile, 'not json {{{');
  await restoreView.locator('[data-testid="restore-file"]').setInputFiles(tmpFile);
  await restoreView.locator('[data-testid="restore-button"]').click();
  await expect(restoreView.getByRole('alert')).toContainText('not valid JSON');
  await fs.unlink(tmpFile).catch(() => undefined);
});
