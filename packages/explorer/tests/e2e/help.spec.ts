import { test, expect } from './fixtures';

test('help view shows orientation content and links to all main areas', async ({ page }) => {
  await page.goto('./');
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Help$/ })
    .click();
  const view = page.locator('pspf-help-view');
  await expect(view.getByRole('heading', { name: 'Help' })).toBeVisible();
  await expect(view.getByRole('heading', { name: 'Getting started' })).toBeVisible();
  await expect(view.getByRole('heading', { name: 'Your data' })).toBeVisible();
  await expect(view.getByRole('heading', { name: 'Privacy & offline use' })).toBeVisible();
  // Sanity-check at least one cross-link
  await expect(view.getByRole('link', { name: 'Backup' })).toBeVisible();
});
