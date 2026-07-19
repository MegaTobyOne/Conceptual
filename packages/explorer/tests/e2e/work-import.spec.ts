import { test, expect } from './fixtures';

const PAYLOAD = {
  pspfWorkImport: 'v1',
  source: 'TestImporter',
  capturedAt: '2025-04-01T00:00:00Z',
  risks: [
    {
      id: 'imp-risk-1',
      title: 'Imported risk',
      likelihood: 4,
      impact: 4,
      status: 'open',
      requirementIds: ['GOV-001'],
    },
  ],
  actions: [
    {
      id: 'imp-action-1',
      title: 'Imported action',
      type: 'remediation',
      status: 'in-progress',
      requirementIds: ['GOV-001'],
      riskIds: ['imp-risk-1'],
    },
  ],
};

test('work import shows plan, applies only selected entries, and confirms updates', async ({
  page,
}) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Import work$/ })
    .click();
  const view = page.locator('pspf-risk-action-import-view');

  // First import: both entries are new (add)
  await view.getByTestId('work-import-file').setInputFiles({
    name: 'payload.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(PAYLOAD)),
  });
  await expect(view.getByTestId('work-import-plan')).toBeVisible();
  await expect(view.getByTestId('work-import-risk-row-0')).toContainText('add');
  await expect(view.getByTestId('work-import-action-row-0')).toContainText('add');

  // Apply button is disabled until something is selected.
  const applyBtn = view.getByTestId('work-import-apply');
  await expect(applyBtn).toBeDisabled();

  // Bulk-select all new risks and actions, then apply.
  await view.getByTestId('work-import-select-new-risks').click();
  await view.getByTestId('work-import-select-new-actions').click();
  await expect(applyBtn).toBeEnabled();
  page.once('dialog', (dialog) => dialog.accept());
  await applyBtn.click();

  const summary = view.getByTestId('work-import-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('1 risk added');
  await expect(summary).toContainText('1 action added');

  // Confirm the records exist in the workspace.
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Risks$/ })
    .click();
  await expect(page.locator('pspf-risks-view')).toContainText('Imported risk');
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Actions$/ })
    .click();
  await expect(page.locator('pspf-actions-view')).toContainText('Imported action');

  // Re-import the same payload with a title change → should plan as updates,
  // and the user should be able to skip an update by leaving its checkbox off.
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Import work$/ })
    .click();
  const updatedPayload = {
    ...PAYLOAD,
    risks: [{ ...PAYLOAD.risks[0], title: 'Imported risk (revised)' }],
    actions: [{ ...PAYLOAD.actions[0], title: 'Imported action (revised)' }],
  };
  await view.getByTestId('work-import-file').setInputFiles({
    name: 'payload-update.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(updatedPayload)),
  });
  await expect(view.getByTestId('work-import-risk-row-0')).toContainText('update');
  await expect(view.getByTestId('work-import-risk-row-0')).toContainText('title');
  await expect(view.getByTestId('work-import-action-row-0')).toContainText('update');

  // Select only the action update — risk should be untouched.
  await view.getByTestId('work-import-select-updated-actions').click();
  page.once('dialog', (dialog) => dialog.accept());
  await applyBtn.click();
  const summary2 = view.getByTestId('work-import-summary');
  await expect(summary2).toContainText('0 risks added, 0 updated');
  await expect(summary2).toContainText('0 actions added, 1 updated');

  // Verify: action title changed, risk title unchanged.
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Actions$/ })
    .click();
  await expect(page.locator('pspf-actions-view')).toContainText('Imported action (revised)');
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Risks$/ })
    .click();
  await expect(page.locator('pspf-risks-view')).toContainText('Imported risk');
  await expect(page.locator('pspf-risks-view')).not.toContainText('revised');
});

test('work import rejects payloads with unknown fields', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Import work$/ })
    .click();
  const view = page.locator('pspf-risk-action-import-view');
  await view.getByTestId('work-import-file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...PAYLOAD, rogue: true })),
  });
  await expect(view.getByTestId('work-import-error')).toBeVisible();
});
