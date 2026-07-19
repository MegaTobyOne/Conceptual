import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test('app shell loads', async ({ page }) => {
  await page.goto('./');

  await expect(page.locator('pspf-app')).toBeVisible();
  await expect(
    page.locator('pspf-app').getByRole('heading', { name: 'PSPF Explorer' }),
  ).toBeVisible();
  await expect(page.locator('pspf-app').getByText('OFFICIAL: Sensitive')).toBeVisible();

  const results = await new AxeBuilder({ page }).include('pspf-app').analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
