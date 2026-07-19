import { test, expect } from './fixtures';

test('command palette opens with Cmd/Ctrl+K and navigates to Risks', async ({ page }) => {
  await page.goto('./');
  // Wait for app shell
  await expect(page.locator('pspf-app')).toBeVisible();

  // Open palette
  await page.keyboard.press('ControlOrMeta+K');
  const palette = page.locator('pspf-command-palette');
  await expect(palette).toHaveAttribute('open', '');

  // Filter and navigate
  await palette.getByLabel('Filter commands').fill('risks');
  await page.keyboard.press('Enter');

  await expect(palette).not.toHaveAttribute('open', '');
  await expect(page).toHaveURL(/#\/risks$/);
});

test('command palette closes on Escape', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('ControlOrMeta+K');
  const palette = page.locator('pspf-command-palette');
  await expect(palette).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(palette).not.toHaveAttribute('open', '');
});
