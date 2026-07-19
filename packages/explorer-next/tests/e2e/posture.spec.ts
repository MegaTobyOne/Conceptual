import { test, expect } from './fixtures';

test('user can set global posture and per-domain overrides, persisting across reload', async ({
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
    .getByRole('link', { name: /^Posture$/ })
    .click();

  const view = page.locator('pspf-posture-view');
  await expect(view.getByRole('heading', { name: /Posture/ })).toBeVisible();

  // Set global posture (first two select elements in the view)
  const allSelects = view.locator('select');
  await allSelects.nth(0).selectOption('high');
  await allSelects.nth(1).selectOption('shields-up');

  // Verify that selections are persisted after reload
  await page.reload();
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Posture$/ })
    .click();

  // Check that threat is set to high and posture to shields-up
  await expect(view.locator('select').nth(0)).toHaveValue('high');
  await expect(view.locator('select').nth(1)).toHaveValue('shields-up');

  // Per-domain override on technology
  await view
    .locator('li.domain', { hasText: 'technology' })
    .getByRole('button', { name: 'Open' })
    .click();
  await view.getByLabel('Threat for technology').selectOption('critical');
  await expect(
    view
      .locator('li.domain', { hasText: 'technology' })
      .locator('span.badge', { hasText: 'critical' }),
  ).toBeVisible();
});
