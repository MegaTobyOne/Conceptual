import { test, expect } from './fixtures';

const PAYLOAD = {
  pspfGrcCapture: 'v1',
  source: 'TestGRC',
  capturedAt: '2025-04-01T00:00:00Z',
  entries: [
    {
      requirementId: 'GOV-001',
      state: 'yes',
      evidenceUrl: 'https://intranet.example/evidence/gov-1',
      reviewer: 'CISO',
    },
    {
      requirementId: 'NOT-REAL',
      state: 'no',
    },
  ],
};

test('GRC capture applies valid entries and surfaces rejected ones', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^GRC capture$/ })
    .click();
  const view = page.locator('pspf-grc-view');
  await view.getByTestId('grc-file').setInputFiles({
    name: 'payload.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(PAYLOAD)),
  });

  const summary = view.getByTestId('grc-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('1 entries applied');
  await expect(summary).toContainText('TestGRC');
  await expect(summary).toContainText('NOT-REAL');

  // Confirm GOV-1 reflects the captured state
  await page.goto('./#/requirement/GOV-001');
  await expect(page.locator('pspf-requirement-view')).toContainText('GOV-001');
});

test('GRC capture rejects payloads with unknown fields', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^GRC capture$/ })
    .click();
  const view = page.locator('pspf-grc-view');
  await view.getByTestId('grc-file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...PAYLOAD, rogue: true })),
  });
  await expect(view.getByTestId('grc-error')).toBeVisible();
});
