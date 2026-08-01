import { test, expect } from './fixtures';

test.describe.configure({ mode: 'serial' });

test('Assurance City renders and persists its accessible focus state', async ({ page }) => {
  await page.goto('./#/map-3d-concepts');

  const city = page.getByRole('region', { name: 'Neon Assurance City interactive view' });
  const canvas = city.locator('canvas');
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate((element) => (element as HTMLCanvasElement).width)).toBeGreaterThan(
    0,
  );
  expect(await canvas.evaluate((element) => (element as HTMLCanvasElement).height)).toBeGreaterThan(
    0,
  );

  await city.getByRole('button', { name: 'Day' }).click();
  await expect(city).toHaveAttribute('data-environment', 'day');

  await city.getByLabel('Focus record').selectOption({ label: 'Credential exposure · risk' });
  await expect(city).toContainText('Critical: Extreme risk');
  await expect(city).toContainText('through route available');
  await expect(city).toContainText('local road and arterial');

  await page.reload();
  await expect(city.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true');
});

test('Assurance City falls back safely when the WebGL context is lost', async ({ page }) => {
  await page.goto('./#/map-3d-concepts');

  const city = page.getByRole('region', { name: 'Neon Assurance City interactive view' });
  const canvas = city.locator('canvas');
  await expect(canvas).toBeVisible();
  await canvas.dispatchEvent('webglcontextlost');

  await expect(city).toContainText('The 3D graphics context was lost. Your data is unchanged');
  await expect(city.getByRole('link', { name: 'Open the current 2D Map' })).toHaveAttribute(
    'href',
    '#/map',
  );
});

test('Assurance City keeps controls and legends separated on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#/map-3d-concepts');

  const city = page.getByRole('region', { name: 'Neon Assurance City interactive view' });
  const overlays = ['.scene-tools', '.inspector', '.axis', '.road-legend'];
  const boxes = await Promise.all(
    overlays.map(async (selector) => {
      const box = await city.locator(selector).boundingBox();
      expect(box).not.toBeNull();
      return box!;
    }),
  );
  const sceneBox = await city.boundingBox();
  expect(sceneBox).not.toBeNull();
  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(sceneBox!.x);
    expect(box.x + box.width).toBeLessThanOrEqual(sceneBox!.x + sceneBox!.width);
  }
  expect(boxes[1]!.y + boxes[1]!.height).toBeLessThanOrEqual(boxes[2]!.y);
  expect(boxes[2]!.y + boxes[2]!.height).toBeLessThanOrEqual(boxes[3]!.y);
});
