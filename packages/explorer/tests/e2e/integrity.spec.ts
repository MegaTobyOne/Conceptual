import { test, expect } from './fixtures';

test('integrity scan reports a clean dataset', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Integrity$/ })
    .click();
  const view = page.locator('pspf-integrity-view');
  await view.getByTestId('run-scan').click();
  await expect(view.getByTestId('clean')).toBeVisible();
  await expect(view.getByTestId('status')).toContainText('0 issues');
});

test('integrity scan flags an orphan compliance entry', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  // Seed an orphan compliance entry directly via IndexedDB
  await page.evaluate(async () => {
    const open = (): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('pspf-explorer.v3');
        req.onsuccess = (): void => resolve(req.result);
        req.onerror = (): void => reject(req.error ?? new Error('open failed'));
      });
    const db = await open();
    const tx = db.transaction('compliance', 'readwrite');
    tx.objectStore('compliance').put({
      requirementId: 'GHOST-999',
      state: 'yes',
      evidence: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = (): void => resolve();
      tx.onerror = (): void => reject(tx.error ?? new Error('tx failed'));
    });
    db.close();
  });
  await page.reload();

  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Integrity$/ })
    .click();
  const view = page.locator('pspf-integrity-view');
  await view.getByTestId('run-scan').click();
  await expect(view.getByTestId('issues').locator('tr[data-entity="compliance"]')).toHaveCount(1);
  await expect(view.getByTestId('status')).toContainText('1 issue');
});
