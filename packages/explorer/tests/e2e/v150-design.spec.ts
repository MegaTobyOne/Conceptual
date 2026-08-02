import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'minimum', width: 320, height: 720 },
] as const;

for (const theme of ['dark', 'light'] as const) {
  for (const viewport of VIEWPORTS) {
    test(`v1.50 ${theme} Home is accessible and bounded at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');
      await page.evaluate((preference) => localStorage.setItem('pspf-theme', preference), theme);
      await page.reload();

      const app = page.locator('pspf-app');
      const home = page.locator('pspf-home-view');
      await expect(home).toBeVisible();
      await expect(app).toHaveAttribute('data-theme', theme);
      await expect(app.getByLabel('Choose colour theme')).toHaveValue(theme);

      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(1);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);

      const screenshot = await page.screenshot({ animations: 'disabled' });
      expect(screenshot.byteLength).toBeGreaterThan(10_000);
    });
  }
}

test('v1.50 System theme follows OS changes and reduced motion', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('./');
  const app = page.locator('pspf-app');
  await app.getByLabel('Choose colour theme').selectOption('system');
  await expect(app).toHaveAttribute('data-theme', 'light');
  await expect(app.getByLabel('Choose colour theme')).toHaveValue('system');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pspf-theme'))).toBe('system');

  const motion = await page
    .locator('pspf-home-view')
    .evaluate((element) => getComputedStyle(element).getPropertyValue('--motion-fast').trim());
  expect(motion).toBe('0ms');

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect(app).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(app.getByLabel('Choose colour theme')).toHaveValue('system');
  await expect(app).toHaveAttribute('data-theme', 'dark');
});

test('v1.50 lenses preserve Requirement records and controls', async ({ page }) => {
  await page.goto('./#/requirement/GOV-001');
  const app = page.locator('pspf-app');
  const requirement = page.locator('pspf-requirement-view');
  await expect(requirement).toContainText('GOV-001');

  const snapshots: string[] = [];
  const routeSets: string[][] = [];
  for (const lens of ['ciso', 'auditor', 'solo'] as const) {
    await app.getByLabel('Choose presentation view').selectOption(lens);
    await expect(requirement.locator('article')).toHaveAttribute('data-lens', lens);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('pspf-presentation-lens')))
      .toBe(lens);
    snapshots.push(
      await requirement
        .locator('article')
        .evaluate((article) =>
          article.outerHTML.replace(/data-lens="(?:ciso|auditor|solo)"/, 'data-lens="lens"'),
        ),
    );
    routeSets.push(
      (
        await app
          .locator('nav.primary a')
          .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
      ).sort(),
    );
  }

  expect(snapshots[1]).toBe(snapshots[0]);
  expect(snapshots[2]).toBe(snapshots[0]);
  expect(routeSets[1]).toEqual(routeSets[0]);
  expect(routeSets[2]).toEqual(routeSets[0]);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('pspf-presentation-lens')))
    .toBe('solo');
  await expect(app.getByLabel('Choose presentation view')).toHaveValue('solo');
  await expect(requirement).toContainText('GOV-001');
});
