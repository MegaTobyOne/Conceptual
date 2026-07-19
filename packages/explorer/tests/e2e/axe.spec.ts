import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

const ROUTES = [
  { route: '/', selector: 'pspf-home-view' },
  { route: '/risks', selector: 'pspf-risks-view' },
  { route: '/actions', selector: 'pspf-actions-view' },
  { route: '/tags', selector: 'pspf-tags-view' },
  { route: '/views', selector: 'pspf-saved-views-view' },
  { route: '/posture', selector: 'pspf-posture-view' },
  { route: '/analytics', selector: 'pspf-analytics-view' },
  { route: '/coverage', selector: 'pspf-coverage-view' },
  { route: '/directions', selector: 'pspf-directions-view' },
  { route: '/relationships', selector: 'pspf-relationships-view' },
  { route: '/map', selector: 'pspf-relationship-map-view' },
  { route: '/share', selector: 'pspf-share-view' },
  { route: '/grc', selector: 'pspf-grc-view' },
  { route: '/backup', selector: 'pspf-backup-view' },
  { route: '/restore', selector: 'pspf-restore-view' },
  { route: '/help', selector: 'pspf-help-view' },
];

for (const { route, selector } of ROUTES) {
  test(`axe: ${route} has no detectable WCAG 2.1 A/AA violations`, async ({ page }) => {
    await page.goto(`./#${route}`);
    await page.locator('pspf-app').waitFor();
    await expect(page.locator(selector)).toBeVisible();
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (results.violations.length > 0) {
      // Pretty-print to make the failure actionable
      console.log(
        JSON.stringify(
          results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.length,
          })),
          null,
          2,
        ),
      );
    }
    expect(results.violations).toEqual([]);
  });
}
