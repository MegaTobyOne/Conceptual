import { expect, test } from './fixtures';

test('v1.52 exposes canonical Studio System tokens and compact density', async ({ page }) => {
  await page.goto('./');
  const app = page.locator('pspf-app');
  await expect(app).toBeVisible();

  const tokens = await app.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      body: styles.getPropertyValue('--text-base').trim(),
      product: styles.getPropertyValue('--pspf-product-pub').trim(),
      domain: styles.getPropertyValue('--pspf-domain-governance').trim(),
      muted: styles.getPropertyValue('--pspf-muted').trim(),
    };
  });

  expect(tokens.body).toBe('0.8125rem');
  expect(tokens.product).not.toBe('');
  expect(tokens.domain).not.toBe('');
  expect(tokens.muted).not.toBe('');
});

for (const state of [
  { name: 'full', width: 1440, primary: 'grid', mobile: 'none', columns: 4 },
  { name: 'condensed', width: 1100, primary: 'grid', mobile: 'none', columns: 2 },
  { name: 'mobile', width: 980, primary: 'none', mobile: 'block', columns: 0 },
] as const) {
  test(`v1.52 ${state.name} navigation is bounded and usable`, async ({ page }) => {
    await page.setViewportSize({ width: state.width, height: 900 });
    await page.goto('./');

    const app = page.locator('pspf-app');
    const primary = app.locator('nav.primary');
    const mobile = app.locator('details.mobile-nav');
    await expect(primary).toHaveCSS('display', state.primary);
    await expect(mobile).toHaveCSS('display', state.mobile);

    if (state.columns > 0) {
      const columnCount = await primary.evaluate(
        (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
      );
      expect(columnCount).toBe(state.columns);
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('v1.52 command trigger opens the keyboard command palette', async ({ page }) => {
  await page.goto('./');
  const app = page.locator('pspf-app');
  await app.getByRole('button', { name: 'Open command palette' }).click();
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
  await expect(page.getByLabel('Filter commands')).toBeFocused();
});

test('v1.52 relationship statuses use the shared bounded chip', async ({ page }) => {
  await page.goto('./#/map');
  const map = page.locator('pspf-relationship-map-view');
  await expect(map).toBeVisible();
  await map.evaluate((element) => {
    const chip = document.createElement('pspf-status-chip');
    chip.textContent = 'Risk-managed with a deliberately long bounded status label';
    element.shadowRoot?.append(chip);
  });

  const chip = map.locator('pspf-status-chip').first();
  await expect(chip).toBeVisible();
  const layout = await chip.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { minWidth: styles.minWidth, maxWidth: styles.maxWidth };
  });
  expect(layout.minWidth).toBe('0px');
  expect(layout.maxWidth).not.toBe('none');
});
